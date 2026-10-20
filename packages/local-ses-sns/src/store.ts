import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const ACCOUNT_ID = "000000000000";
const MAX_MESSAGES = 500;

export type Identity = {
  name: string;
  region: string;
  configurationSetName?: string;
  dkimSelector?: string;
  mailFromDomain?: string;
  createdAt: string;
};

export type EventDestination = {
  name: string;
  enabled: boolean;
  matchingEventTypes: string[];
  topicArn?: string;
};

export type Subscription = { arn: string; topicArn: string; protocol: string; endpoint: string };

export type Outcome = "delivered" | "bounced" | "complained" | "suppressed";

export type CapturedMessage = {
  id: string;
  region: string;
  configurationSetName?: string;
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  headers: Array<{ name: string; value: string }>;
  outcome: Outcome;
  receivedAt: string;
};

type State = {
  identities: Record<string, Identity>;
  configurationSets: Record<string, Record<string, EventDestination>>;
  topics: string[];
  subscriptions: Subscription[];
  messages: CapturedMessage[];
};

const DATA_FILE = process.env.DATA_FILE ?? "./data/state.json";

function load(): State {
  const empty: State = { identities: {}, configurationSets: {}, topics: [], subscriptions: [], messages: [] };
  if (!existsSync(DATA_FILE)) return empty;
  try {
    return { ...empty, ...(JSON.parse(readFileSync(DATA_FILE, "utf8")) as Partial<State>) };
  } catch {
    return empty;
  }
}

export const state = load();

let saveTimer: NodeJS.Timeout | undefined;

/** Writes state to disk shortly after the last change, so the app's stored topic ARNs keep working after a restart. */
export function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      mkdirSync(dirname(DATA_FILE), { recursive: true });
      writeFileSync(DATA_FILE, JSON.stringify(state));
    } catch (error) {
      console.warn("[local-ses-sns] couldn't save state:", (error as Error).message);
    }
  }, 200);
}

export function addMessage(message: CapturedMessage) {
  state.messages.unshift(message);
  state.messages.length = Math.min(state.messages.length, MAX_MESSAGES);
  persist();
}

export function topicArn(region: string, name: string) {
  return `arn:aws:sns:${region}:${ACCOUNT_ID}:${name}`;
}
