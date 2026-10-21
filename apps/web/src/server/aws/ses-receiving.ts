import {
  CreateReceiptRuleCommand,
  CreateReceiptRuleSetCommand,
  DescribeActiveReceiptRuleSetCommand,
  DescribeReceiptRuleSetCommand,
  SESClient,
  SetActiveReceiptRuleSetCommand,
  UpdateReceiptRuleCommand,
  type ReceiptRule,
} from "@aws-sdk/client-ses";
import { CreateEmailIdentityCommand, DeleteEmailIdentityCommand, GetEmailIdentityCommand } from "@aws-sdk/client-sesv2";
import { env } from "~/env";
import { logger } from "../logger/log";
import { generateKeyPair, getSesClient } from "./ses";

export const INBOUND_RULE_SET = "bytesend-inbound";
const INBOUND_RULE = "bytesend-store-and-notify";
export const INBOUND_RAW_PREFIX = "raw/";

function getClassicClient(region: string) {
  return new SESClient({
    region,
    endpoint: env.AWS_SES_ENDPOINT,
    credentials: { accessKeyId: env.AWS_ACCESS_KEY, secretAccessKey: env.AWS_SECRET_KEY },
  });
}

export function inboundMxHost(region: string = env.INBOUND_REGION) {
  return `inbound-smtp.${region}.amazonaws.com`;
}

export async function getReceivingRuleState(region: string = env.INBOUND_REGION) {
  const active = await getClassicClient(region).send(new DescribeActiveReceiptRuleSetCommand({}));
  const rule = active.Rules?.find((r) => r.Name === INBOUND_RULE);
  return {
    ruleSetActive: active.Metadata?.Name === INBOUND_RULE_SET,
    ruleEnabled: Boolean(rule?.Enabled),
    notifiesTopic: Boolean(rule?.Actions?.some((action) => action.S3Action?.TopicArn)),
  };
}

export async function ensureReceivingRules({
  region = env.INBOUND_REGION,
  bucket = env.INBOUND_S3_BUCKET,
  topicArn = env.INBOUND_SNS_TOPIC_ARN,
}: { region?: string; bucket?: string; topicArn?: string } = {}) {
  if (!bucket || !topicArn) {
    throw new Error("Set INBOUND_S3_BUCKET and INBOUND_SNS_TOPIC_ARN before setting up receiving");
  }
  const client = getClassicClient(region);

  try {
    await client.send(new CreateReceiptRuleSetCommand({ RuleSetName: INBOUND_RULE_SET }));
  } catch (error) {
    if ((error as Error).name !== "AlreadyExistsException") throw error;
  }

  const rule: ReceiptRule = {
    Name: INBOUND_RULE,
    Enabled: true,
    ScanEnabled: true,
    TlsPolicy: "Optional",
    Actions: [{ S3Action: { BucketName: bucket, ObjectKeyPrefix: INBOUND_RAW_PREFIX, TopicArn: topicArn } }],
  };

  const existing = await client.send(new DescribeReceiptRuleSetCommand({ RuleSetName: INBOUND_RULE_SET }));
  if (existing.Rules?.some((r) => r.Name === INBOUND_RULE)) {
    await client.send(new UpdateReceiptRuleCommand({ RuleSetName: INBOUND_RULE_SET, Rule: rule }));
  } else {
    await client.send(new CreateReceiptRuleCommand({ RuleSetName: INBOUND_RULE_SET, Rule: rule }));
  }

  const active = await client.send(new DescribeActiveReceiptRuleSetCommand({}));
  if (active.Metadata?.Name !== INBOUND_RULE_SET) {
    await client.send(new SetActiveReceiptRuleSetCommand({ RuleSetName: INBOUND_RULE_SET }));
  }

  logger.info({ region, bucket }, "[Inbound]: Receiving rules in place");
  return { region, ruleSet: INBOUND_RULE_SET, rule: INBOUND_RULE };
}

export async function createReceivingIdentity(fqdn: string, selector: string, region: string = env.INBOUND_REGION) {
  const client = getSesClient(region);
  const { privateKey, publicKey } = generateKeyPair();
  const command = new CreateEmailIdentityCommand({
    EmailIdentity: fqdn,
    DkimSigningAttributes: { DomainSigningSelector: selector, DomainSigningPrivateKey: privateKey },
  });
  try {
    await client.send(command);
  } catch (error) {
    if ((error as Error).name !== "AlreadyExistsException") throw error;
    await client.send(new DeleteEmailIdentityCommand({ EmailIdentity: fqdn }));
    await client.send(command);
  }
  return { publicKey };
}

export async function deleteReceivingIdentity(fqdn: string, region: string = env.INBOUND_REGION) {
  try {
    await getSesClient(region).send(new DeleteEmailIdentityCommand({ EmailIdentity: fqdn }));
  } catch (error) {
    if ((error as Error).name !== "NotFoundException") throw error;
  }
}

export async function isIdentityVerified(identity: string, region: string = env.INBOUND_REGION) {
  try {
    const response = await getSesClient(region).send(new GetEmailIdentityCommand({ EmailIdentity: identity }));
    return Boolean(response.VerifiedForSendingStatus);
  } catch (error) {
    if ((error as Error).name === "NotFoundException") return false;
    throw error;
  }
}
