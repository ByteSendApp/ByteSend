import { env } from "~/env";
import { ByteSend } from "bytesend-js";
import { isSelfHosted } from "~/utils/common";
import { db } from "./db";
import { getDomains } from "./service/domain-service";
import { sendEmail } from "./service/email-service";
import { logger } from "./logger/log";
import { renderOtpEmail, renderTeamInviteEmail } from "./email-templates";

let bytesend: ByteSend | undefined;

const getClient = () => {
  if (!bytesend) {
    bytesend = new ByteSend(env.BYTESEND_API_KEY);
  }
  return bytesend;
};

export async function sendSignUpEmail(
  email: string,
  token: string,
  url: string
) {
  const { host } = new URL(url);

  if (env.NODE_ENV === "development") {
    logger.info({ email, url, token }, "Sending sign in email");
    return;
  }

  const subject = "Sign in to ByteSend";

  const html = await renderOtpEmail({
    otpCode: token.toUpperCase(),
    loginUrl: url,
    hostName: host,
  });

  const text = `Hey,\n\nYou can sign in to ByteSend by clicking the below URL:\n${url}\n\nYou can also use this OTP: ${token}\n\nThanks,\nByteSend Team`;

  await sendMail(email, subject, text, html);
}

export async function sendTeamInviteEmail(
  email: string,
  url: string,
  teamName: string
) {
  const { host } = new URL(url);

  if (env.NODE_ENV === "development") {
    logger.info({ email, url, teamName }, "Sending team invite email");
    return;
  }

  const subject = "You have been invited to join ByteSend";

  const html = await renderTeamInviteEmail({
    teamName,
    inviteUrl: url,
  });

  const text = `Hey,\n\nYou have been invited to join the team ${teamName} on ByteSend.\n\nYou can accept the invitation by clicking the below URL:\n${url}\n\nThanks,\nByteSend Team`;

  await sendMail(email, subject, text, html);
}

export async function sendSubscriptionConfirmationEmail(email: string) {
  if (!env.FOUNDER_EMAIL) {
    logger.error("FOUNDER_EMAIL not configured");
    return;
  }

  const subject = "Thanks for subscribing to ByteSend";
  const text = `Hey,\n\nThanks for subscribing to ByteSend, just wanted to let you know you can join the discord server to have a dedicated support channel for your team. So that we can address your queries / bugs asap.\n\nYou can join over using the link: https://discord.com/invite/BU8n8pJv8S\n\nIf you prefer slack, please let me know\n\ncheers,\nByteSend Team`;
  const html = text.replace(/\n/g, "<br />");

  await sendMail(email, subject, text, html, undefined, env.FOUNDER_EMAIL);
}

export async function sendEmailChangeVerificationEmail(
  email: string,
  token: string,
  subject?: string
) {
  if (env.NODE_ENV === "development") {
    logger.info({ email, token }, "Sending email change verification code");
    return;
  }

  const finalSubject = subject ?? "Confirm your new ByteSend email";
  const text = `Hey,\n\nUse this verification code to confirm your email address change:\n\n${token}\n\nThis code expires in 15 minutes.\n\nIf you did not request this change, you can ignore this email.\n\nThanks,\nByteSend Team`;
  const html = [
    "<p>Hey,</p>",
    "<p>Use this verification code to confirm your email address change:</p>",
    `<p style=\"font-size:24px;font-weight:700;letter-spacing:0.08em;\">${token}</p>`,
    "<p>This code expires in 15 minutes.</p>",
    "<p>If you did not request this change, you can ignore this email.</p>",
    "<p>Thanks,<br/>ByteSend Team</p>",
  ].join("");

  await sendMail(email, finalSubject, text, html);
}

export async function sendBackupEmailVerificationEmail(
  email: string,
  token: string
) {
  if (env.NODE_ENV === "development") {
    logger.info({ email, token }, "Sending backup email verification code");
    return;
  }

  const subject = "Verify your backup email address";
  const text = `Hey,\n\nUse this verification code to confirm your backup email address:\n\n${token}\n\nThis code expires in 15 minutes.\n\nIf you did not request this, you can ignore this email.\n\nThanks,\nByteSend Team`;
  const html = [
    "<p>Hey,</p>",
    "<p>Use this verification code to confirm your backup email address:</p>",
    `<p style=\"font-size:24px;font-weight:700;letter-spacing:0.08em;\">${token}</p>`,
    "<p>This code expires in 15 minutes.</p>",
    "<p>If you did not request this, you can ignore this email.</p>",
    "<p>Thanks,<br/>ByteSend Team</p>",
  ].join("");

  await sendMail(email, subject, text, html);
}

export async function sendMail(
  email: string,
  subject: string,
  text: string,
  html: string,
  replyTo?: string,
  fromOverride?: string
) {
  const hasApiKey = !!env.BYTESEND_API_KEY;

  if (isSelfHosted() || !hasApiKey) {
    logger.info("Sending email using self hosted");
    /* 
      Self hosted so checking if we can send using one of the available domain
      Assuming self hosted will have only one team
      TODO: fix this
     */
    const team = await db.team.findFirst({});
    if (!team) {
      logger.error("No team found");
      return;
    }

    const allDomains = await getDomains(team.id);

    if (allDomains.length === 0) {
      logger.error("No domains found");
      return;
    }

    const domains = allDomains.filter((d) => d.status === "SUCCESS");
    const domain = domains[0] ?? allDomains[0]!;

    if (!domain) {
      logger.error("No usable domain found");
      return;
    }

    const availableDomains = (domains.length > 0 ? domains : allDomains).map((d) => d.name);

    const candidateFroms = [fromOverride, env.FROM_EMAIL, `hello@${domain.name}`].filter(
      (value): value is string => Boolean(value)
    );

    const selectedFrom =
      candidateFroms.find((address) => {
        const domainPart = address.split("@")[1];
        return domainPart ? availableDomains.includes(domainPart) : false;
      }) ?? `hello@${domain.name}`;

    await sendEmail({
      teamId: team.id,
      to: email,
      from: selectedFrom,
      subject,
      text,
      html,
      replyTo,
    });
  } else if (env.FROM_EMAIL || fromOverride) {
    const fromAddress = fromOverride ?? env.FROM_EMAIL!;
    const resp = await getClient().emails.send({
      to: email,
      from: fromAddress,
      subject,
      text,
      html,
      replyTo,
    });

    if (resp.data) {
      logger.info("Email sent using bytesend");
      return;
    } else {
      logger.error(
        { code: resp.error?.code, message: resp.error?.message },
        "Error sending email using bytesend"
      );
    }
  } else {
    logger.error("No FROM_EMAIL configured, cannot send email");
  }
}
