import { EmailContent } from "~/types";
import { db } from "../db";
import { ByteSendApiError } from "~/server/public-api/api-error";
import { EmailQueueService } from "./email-queue-service";
import {
  validateDomainFromEmail,
  validateApiKeyDomainAccess,
} from "./domain-service";
import { EmailRenderer } from "@bytesend/email-editor/src/renderer";
import { logger } from "../logger/log";
import { SuppressionService } from "./suppression-service";
import { sanitizeCustomHeaders } from "~/server/utils/email-headers";
import { Prisma } from "@prisma/client";
import { SpamScanService, type SpamResult } from "./spam-scan-service";
import { assertTestAllowance } from "./test-mode-service";

async function checkIfValidEmail(emailId: string) {
  const email = await db.email.findUnique({
    where: { id: emailId },
  });

  if (!email || !email.domainId) {
    throw new ByteSendApiError({
      code: "BAD_REQUEST",
      message: "Email not found",
    });
  }

  const domain = await db.domain.findUnique({
    where: { id: email.domainId },
  });

  if (!domain) {
    throw new ByteSendApiError({
      code: "BAD_REQUEST",
      message: "Email not found",
    });
  }

  return { email, domain };
}

async function scanForSpam(params: {
  teamId: number;
  from: string;
  subject: string;
  html?: string | null;
  text?: string | null;
  attachmentNames?: string[];
}): Promise<SpamResult | null> {
  try {
    const team = await db.team.findUnique({ where: { id: params.teamId }, select: { createdAt: true } });
    return await SpamScanService.scan({ ...params, teamCreatedAt: team?.createdAt });
  } catch (error) {
    logger.error({ err: error, teamId: params.teamId }, "[EmailService]: Spam scan failed; sending unscanned");
    return null;
  }
}

async function recordSpamResult(teamId: number, emailId: string, result: SpamResult | null) {
  if (!result?.verdict) return;
  try {
    await SpamScanService.record({ teamId, emailId, result });
    if (result.verdict === "HOLD") {
      await db.emailEvent.create({
        data: {
          emailId,
          status: "HELD",
          data: {
            reason: "Held for review by ByteSend's spam protection",
            score: result.score,
            rules: result.hits.map((hit) => hit.rule),
          },
          teamId,
        },
      });
    }
  } catch (error) {
    logger.error({ err: error, teamId, emailId }, "[EmailService]: Failed to record spam result");
  }
}

export const replaceVariables = (
  text: string,
  variables: Record<string, string>
) => {
  return Object.keys(variables).reduce((accum, key) => {
    const re = new RegExp(`{{${key}}}`, "g");
    const returnTxt = accum.replace(re, variables[key] as string);
    return returnTxt;
  }, text);
};

export async function sendEmail(
  emailContent: EmailContent & { teamId: number; apiKeyId?: number }
) {
  const {
    to,
    from,
    subject: subjectFromApiCall,
    templateId,
    variables,
    text,
    html: htmlFromApiCall,
    teamId,
    attachments,
    replyTo,
    cc,
    bcc,
    scheduledAt,
    apiKeyId,
    inReplyToId,
    headers,
  } = emailContent;
  let subject = subjectFromApiCall;
  let html = htmlFromApiCall;

  let domain: Awaited<ReturnType<typeof validateDomainFromEmail>>;
  let isTest = false;

  if (apiKeyId) {
    const apiKey = await db.apiKey.findUnique({
      where: { id: apiKeyId },
      include: { domain: true },
    });

    if (!apiKey) {
      throw new ByteSendApiError({
        code: "BAD_REQUEST",
        message: "Invalid API key",
      });
    }

    domain = await validateApiKeyDomainAccess(from, teamId, apiKey);
    isTest = apiKey.isTest;
    if (isTest) await assertTestAllowance(teamId);
  } else {
    domain = await validateDomainFromEmail(from, teamId);
  }

  const toEmails = Array.isArray(to) ? to : [to];
  const ccEmails = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
  const bccEmails = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [];

  const allEmailsToCheck = [
    ...new Set([...toEmails, ...ccEmails, ...bccEmails]),
  ];

  const suppressionResults = await SuppressionService.checkMultipleEmails(
    allEmailsToCheck,
    teamId
  );

  const filteredToEmails = toEmails.filter(
    (email) => !suppressionResults[email]
  );
  const filteredCcEmails = ccEmails.filter(
    (email) => !suppressionResults[email]
  );
  const filteredBccEmails = bccEmails.filter(
    (email) => !suppressionResults[email]
  );

  if (filteredToEmails.length === 0) {
    logger.info(
      {
        to,
        teamId,
      },
      "All TO recipients are suppressed. No emails to send."
    );

    const email = await db.email.create({
      data: {
        to: toEmails,
        from,
        subject: subject as string,
        teamId,
        domainId: domain.id,
        latestStatus: "SUPPRESSED",
        apiId: apiKeyId,
        isTest,
        text,
        html,
        cc: ccEmails.length > 0 ? ccEmails : undefined,
        bcc: bccEmails.length > 0 ? bccEmails : undefined,
        inReplyToId,
      },
    });

    await db.emailEvent.create({
      data: {
        emailId: email.id,
        status: "SUPPRESSED",
        data: {
          error: "All TO recipients are suppressed. No emails to send.",
        },
        teamId,
      },
    });

    return email;
  }

  if (ccEmails.length > filteredCcEmails.length) {
    logger.info(
      {
        originalCc: ccEmails,
        filteredCc: filteredCcEmails,
        teamId,
      },
      "Some CC recipients were suppressed and filtered out."
    );
  }

  if (bccEmails.length > filteredBccEmails.length) {
    logger.info(
      {
        originalBcc: bccEmails,
        filteredBcc: filteredBccEmails,
        teamId,
      },
      "Some BCC recipients were suppressed and filtered out."
    );
  }

  if (templateId) {
    const template = await db.template.findUnique({
      where: { id: templateId },
    });

    if (template) {
      const jsonContent = JSON.parse(template.content || "{}");
      const renderer = new EmailRenderer(jsonContent);

      subject = replaceVariables(template.subject || "", variables || {});

      // {{}} for link replacements
      const modifiedVariables = {
        ...variables,
        ...Object.keys(variables || {}).reduce(
          (acc, key) => {
            acc[`{{${key}}}`] = variables?.[key] || "";
            return acc;
          },
          {} as Record<string, string>
        ),
      };

      html = await renderer.render({
        shouldReplaceVariableValues: true,
        variableValues: modifiedVariables,
      });
    }
  }

  if (inReplyToId) {
    const email = await db.email.findUnique({
      where: {
        id: inReplyToId,
        teamId,
      },
    });

    if (!email) {
      throw new ByteSendApiError({
        code: "BAD_REQUEST",
        message: '"inReplyTo" is invalid',
      });
    }
  }

  if (!text && !html) {
    throw new ByteSendApiError({
      code: "BAD_REQUEST",
      message: "Either text or html is required",
    });
  }

  const scheduledAtDate = scheduledAt ? new Date(scheduledAt) : undefined;
  const delay = scheduledAtDate
    ? Math.max(0, scheduledAtDate.getTime() - Date.now())
    : undefined;

  const spamResult = isTest
    ? null
    : await scanForSpam({
        teamId,
        from,
        subject: subject ?? "",
        html,
        text,
        attachmentNames: attachments?.map((attachment) => attachment.filename),
      });
  const isHeld = spamResult?.verdict === "HOLD";

  const email = await db.email.create({
    data: {
      to: filteredToEmails,
      from,
      subject: subject as string,
      replyTo: replyTo
        ? Array.isArray(replyTo)
          ? replyTo
          : [replyTo]
        : undefined,
      cc: filteredCcEmails.length > 0 ? filteredCcEmails : undefined,
      bcc: filteredBccEmails.length > 0 ? filteredBccEmails : undefined,
      text,
      html,
      teamId,
      domainId: domain.id,
      attachments: attachments ? JSON.stringify(attachments) : undefined,
      scheduledAt: scheduledAtDate,
      latestStatus: isHeld ? "HELD" : scheduledAtDate ? "SCHEDULED" : "QUEUED",
      apiId: apiKeyId,
      isTest,
      inReplyToId,
      headers: headers ? JSON.stringify(headers) : undefined,
    },
  });

  await recordSpamResult(teamId, email.id, spamResult);
  if (isHeld) {
    return email;
  }

  try {
    await EmailQueueService.queueEmail(
      email.id,
      teamId,
      domain.region,
      true,
      undefined,
      delay
    );
  } catch (error: any) {
    await db.emailEvent.create({
      data: {
        emailId: email.id,
        status: "FAILED",
        data: {
          error: error.toString(),
        },
        teamId,
      },
    });
    await db.email.update({
      where: { id: email.id },
      data: { latestStatus: "FAILED" },
    });
    throw error;
  }

  return email;
}

export async function updateEmail(
  emailId: string,
  {
    scheduledAt,
  }: {
    scheduledAt?: string;
  }
) {
  const { email, domain } = await checkIfValidEmail(emailId);

  if (email.latestStatus !== "SCHEDULED") {
    throw new ByteSendApiError({
      code: "BAD_REQUEST",
      message: "Email already processed",
    });
  }

  const scheduledAtDate = scheduledAt ? new Date(scheduledAt) : undefined;
  const delay = scheduledAtDate
    ? Math.max(0, scheduledAtDate.getTime() - Date.now())
    : undefined;

  await db.email.update({
    where: { id: emailId },
    data: {
      scheduledAt: scheduledAtDate,
    },
  });

  await EmailQueueService.changeDelay(emailId, domain.region, true, delay ?? 0);
}

export async function cancelEmail(emailId: string) {
  const { email, domain } = await checkIfValidEmail(emailId);

  if (email.latestStatus !== "SCHEDULED") {
    throw new ByteSendApiError({
      code: "BAD_REQUEST",
      message: "Email already processed",
    });
  }

  await EmailQueueService.chancelEmail(emailId, domain.region, true);

  await db.email.update({
    where: { id: emailId },
    data: {
      latestStatus: "CANCELLED",
    },
  });

  await db.emailEvent.create({
    data: {
      emailId,
      status: "CANCELLED",
      teamId: email.teamId,
    },
  });
}

export async function sendBulkEmails(
  emailContents: Array<
    EmailContent & {
      teamId: number;
      apiKeyId?: number;
    }
  >
) {
  if (emailContents.length === 0) {
    throw new ByteSendApiError({
      code: "BAD_REQUEST",
      message: "No emails provided for bulk send",
    });
  }

  if (emailContents.length > 100) {
    throw new ByteSendApiError({
      code: "BAD_REQUEST",
      message: "Cannot send more than 100 emails in a single bulk request",
    });
  }

  const bulkApiKeyId = emailContents[0]?.apiKeyId;
  const bulkApiKey = bulkApiKeyId
    ? await db.apiKey.findUnique({ where: { id: bulkApiKeyId }, include: { domain: true } })
    : null;
  const isTest = bulkApiKey?.isTest ?? false;
  if (isTest) await assertTestAllowance(emailContents[0]!.teamId, emailContents.length);
  const validateFrom = (from: string, teamId: number) =>
    bulkApiKey ? validateApiKeyDomainAccess(from, teamId, bulkApiKey) : validateDomainFromEmail(from, teamId);

  const emailChecks = await Promise.all(
    emailContents.map(async (content, index) => {
      const toEmails = Array.isArray(content.to) ? content.to : [content.to];
      const ccEmails = content.cc
        ? Array.isArray(content.cc)
          ? content.cc
          : [content.cc]
        : [];
      const bccEmails = content.bcc
        ? Array.isArray(content.bcc)
          ? content.bcc
          : [content.bcc]
        : [];
      const allEmailsToCheck = [
        ...new Set([...toEmails, ...ccEmails, ...bccEmails]),
      ];

      const suppressionResults = await SuppressionService.checkMultipleEmails(
        allEmailsToCheck,
        content.teamId
      );

      const filteredToEmails = toEmails.filter(
        (email) => !suppressionResults[email]
      );
      const filteredCcEmails = ccEmails.filter(
        (email) => !suppressionResults[email]
      );
      const filteredBccEmails = bccEmails.filter(
        (email) => !suppressionResults[email]
      );

      const hasSuppressedToEmails = filteredToEmails.length === 0;

      return {
        originalIndex: index,
        content: {
          ...content,
          to: filteredToEmails,
          cc: filteredCcEmails.length > 0 ? filteredCcEmails : undefined,
          bcc: filteredBccEmails.length > 0 ? filteredBccEmails : undefined,
        },
        suppressed: hasSuppressedToEmails,
        suppressedEmails: toEmails.filter((email) => suppressionResults[email]),
        suppressedCcEmails: ccEmails.filter(
          (email) => suppressionResults[email]
        ),
        suppressedBccEmails: bccEmails.filter(
          (email) => suppressionResults[email]
        ),
      };
    })
  );

  const validEmails = emailChecks.filter((check) => !check.suppressed);
  const suppressedEmailsInfo = emailChecks.filter((check) => check.suppressed);

  if (suppressedEmailsInfo.length > 0) {
    logger.info(
      {
        suppressedCount: suppressedEmailsInfo.length,
        totalCount: emailContents.length,
        suppressedEmails: suppressedEmailsInfo.map((info) => ({
          to: info.content.to,
          suppressedAddresses: info.suppressedEmails,
        })),
      },
      "Filtered suppressed emails from bulk send"
    );
  }

  const filteredEmailContents = validEmails.map((check) => check.content);

  const suppressedEmails = [];
  for (const suppressedInfo of suppressedEmailsInfo) {
    const originalContent = emailContents[suppressedInfo.originalIndex];
    if (!originalContent) continue;

    const {
      to,
      from,
      subject: subjectFromApiCall,
      templateId,
      variables,
      text,
      html: htmlFromApiCall,
      teamId,
      attachments,
      replyTo,
      cc,
      bcc,
      scheduledAt,
      apiKeyId,
      inReplyToId,
    } = originalContent;

    let subject = subjectFromApiCall;
    let html = htmlFromApiCall;

    const domain = await validateFrom(from, teamId);

    if (templateId) {
      const template = await db.template.findUnique({
        where: { id: templateId },
      });

      if (template) {
        const jsonContent = JSON.parse(template.content || "{}");
        const renderer = new EmailRenderer(jsonContent);

        subject = replaceVariables(template.subject || "", variables || {});

        const modifiedVariables = {
          ...variables,
          ...Object.keys(variables || {}).reduce(
            (acc, key) => {
              acc[`{{${key}}}`] = variables?.[key] || "";
              return acc;
            },
            {} as Record<string, string>
          ),
        };

        html = await renderer.render({
          shouldReplaceVariableValues: true,
          variableValues: modifiedVariables,
        });
      }
    }

    const originalToEmails = Array.isArray(originalContent.to)
      ? originalContent.to
      : [originalContent.to];
    const originalCcEmails = originalContent.cc
      ? Array.isArray(originalContent.cc)
        ? originalContent.cc
        : [originalContent.cc]
      : [];
    const originalBccEmails = originalContent.bcc
      ? Array.isArray(originalContent.bcc)
        ? originalContent.bcc
        : [originalContent.bcc]
      : [];

    const email = await db.email.create({
      data: {
        to: originalToEmails,
        from,
        subject: subject as string,
        replyTo: replyTo
          ? Array.isArray(replyTo)
            ? replyTo
            : [replyTo]
          : undefined,
        cc: originalCcEmails.length > 0 ? originalCcEmails : undefined,
        bcc: originalBccEmails.length > 0 ? originalBccEmails : undefined,
        text,
        html,
        teamId,
        domainId: domain.id,
        attachments: attachments ? JSON.stringify(attachments) : undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        latestStatus: "SUPPRESSED",
        apiId: apiKeyId,
        isTest,
        inReplyToId,
        headers: originalContent.headers
          ? JSON.stringify(originalContent.headers)
          : undefined,
      },
    });

    await db.emailEvent.create({
      data: {
        emailId: email.id,
        status: "SUPPRESSED",
        data: {
          error: "All TO recipients are suppressed. No emails to send.",
        },
        teamId,
      },
    });

    suppressedEmails.push({
      email,
      originalIndex: suppressedInfo.originalIndex,
    });
  }

  if (filteredEmailContents.length === 0) {
    return suppressedEmails.map((item) => item.email);
  }

  const emailsByDomain = new Map<
    string,
    {
      domain: Awaited<ReturnType<typeof validateDomainFromEmail>>;
      emails: typeof filteredEmailContents;
    }
  >();

  for (const content of filteredEmailContents) {
    const { from } = content;
    if (!emailsByDomain.has(from)) {
      const domain = await validateFrom(from, content.teamId);
      emailsByDomain.set(from, { domain, emails: [] });
    }
    emailsByDomain.get(from)?.emails.push(content);
  }

  const templateCache = new Map<
    number,
    { subject: string; content: any; renderer: EmailRenderer }
  >();

  const createdEmails = [];

  const heldEmailIds = new Set<string>();
  const queueJobs = [];

  for (const { domain, emails } of emailsByDomain.values()) {
    for (const content of emails) {
      const {
        to,
        from,
        subject: subjectFromApiCall,
        templateId,
        variables,
        text,
        html: htmlFromApiCall,
        teamId,
        attachments,
        replyTo,
        cc,
        bcc,
        scheduledAt,
        apiKeyId,
        headers,
      } = content;

      const originalIndex =
        validEmails.find((check) => check.content === content)?.originalIndex ??
        -1;

      let subject = subjectFromApiCall;
      let html = htmlFromApiCall;

      if (templateId) {
        let templateData = templateCache.get(Number(templateId));
        if (!templateData) {
          const template = await db.template.findUnique({
            where: { id: templateId },
          });
          if (template) {
            const jsonContent = JSON.parse(template.content || "{}");
            templateData = {
              subject: template.subject || "",
              content: jsonContent,
              renderer: new EmailRenderer(jsonContent),
            };
            templateCache.set(Number(templateId), templateData);
          }
        }

        if (templateData) {
          subject = replaceVariables(templateData.subject, variables || {});

          const modifiedVariables = {
            ...variables,
            ...Object.keys(variables || {}).reduce(
              (acc, key) => {
                acc[`{{${key}}}`] = variables?.[key] || "";
                return acc;
              },
              {} as Record<string, string>
            ),
          };

          html = await templateData.renderer.render({
            shouldReplaceVariableValues: true,
            variableValues: modifiedVariables,
          });
        }
      }

      if (!text && !html) {
        throw new ByteSendApiError({
          code: "BAD_REQUEST",
          message: `Either text or html is required for email to ${to}`,
        });
      }

      const scheduledAtDate = scheduledAt ? new Date(scheduledAt) : undefined;
      const delay = scheduledAtDate
        ? Math.max(0, scheduledAtDate.getTime() - Date.now())
        : undefined;

      const spamResult = isTest
        ? null
        : await scanForSpam({
            teamId,
            from,
            subject: subject ?? "",
            html,
            text,
            attachmentNames: attachments?.map((attachment) => attachment.filename),
          });
      const isHeld = spamResult?.verdict === "HOLD";

      try {
        const email = await db.email.create({
          data: {
            to: Array.isArray(to) ? to : [to],
            from,
            subject: subject as string,
            replyTo: replyTo
              ? Array.isArray(replyTo)
                ? replyTo
                : [replyTo]
              : undefined,
            cc: cc && cc.length > 0 ? cc : undefined,
            bcc: bcc && bcc.length > 0 ? bcc : undefined,
            text,
            html,
            teamId,
            domainId: domain.id,
            attachments: attachments ? JSON.stringify(attachments) : undefined,
            scheduledAt: scheduledAtDate,
            latestStatus: isHeld ? "HELD" : scheduledAtDate ? "SCHEDULED" : "QUEUED",
            apiId: apiKeyId,
            isTest,
            headers: headers ? JSON.stringify(headers) : undefined,
          },
        });

        createdEmails.push({ email, originalIndex });
        await recordSpamResult(teamId, email.id, spamResult);
        if (isHeld) {
          heldEmailIds.add(email.id);
          continue;
        }

        queueJobs.push({
          emailId: email.id,
          teamId,
          region: domain.region,
          transactional: true,
          delay,
          timestamp: Date.now(),
        });
      } catch (error: any) {
        logger.error(
          { err: error, to },
          `Failed to create email record for recipient`
        );
      }
    }
  }

  if (queueJobs.length === 0 && heldEmailIds.size === 0) {
    throw new ByteSendApiError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create any email records",
    });
  }

  try {
    if (queueJobs.length > 0) {
      await EmailQueueService.queueBulk(queueJobs);
    }
  } catch (error: any) {
    await Promise.all(
      createdEmails.filter((email) => !heldEmailIds.has(email.email.id)).map(async (email) => {
        await db.emailEvent.create({
          data: {
            emailId: email.email.id,
            status: "FAILED",
            data: {
              error: error.toString(),
            },
            teamId: email.email.teamId,
          },
        });
        await db.email.update({
          where: { id: email.email.id },
          data: { latestStatus: "FAILED" },
        });
      })
    );
    throw error;
  }

  const allEmails = [...suppressedEmails, ...createdEmails];
  allEmails.sort((a, b) => a.originalIndex - b.originalIndex);

  return allEmails.map((item) => item.email);
}
