import { nanoid } from "../nanoid";

const RESERVED_EMAIL_HEADERS = new Set(
  ["x-bytesend-email-id"].map((header) => header.toLowerCase())
);

const HEADER_INJECTION_PATTERN = /[\r\n]/;

export function sanitizeHeader(
  rawName: unknown,
  rawValue: unknown
): { name: string; value: string } | undefined {
  if (typeof rawName !== "string" || typeof rawValue !== "string") {
    return undefined;
  }

  const name = rawName.trim();
  if (!name || RESERVED_EMAIL_HEADERS.has(name.toLowerCase())) {
    return undefined;
  }

  if (
    HEADER_INJECTION_PATTERN.test(name) ||
    HEADER_INJECTION_PATTERN.test(rawValue)
  ) {
    return undefined;
  }

  return { name, value: rawValue };
}

export function sanitizeCustomHeaders(
  headers?: Record<string, string | null | undefined>
): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }

  const sanitizedEntries = Object.entries(headers)
    .map(([name, value]) => sanitizeHeader(name, value))
    .filter((entry): entry is { name: string; value: string } =>
      Boolean(entry)
    );

  if (sanitizedEntries.length === 0) {
    return undefined;
  }

  return sanitizedEntries.reduce(
    (acc, { name, value }) => {
      acc[name] = value;
      return acc;
    },
    {} as Record<string, string>
  );
}

export function buildHeaders({
  emailId,
  headers,
  unsubUrl,
  unsubOneClickUrl,
  isBulk,
  inReplyToMessageId,
}: {
  emailId?: string | undefined;
  headers?: Record<string, string> | undefined;
  unsubUrl?: string;
  unsubOneClickUrl?: string;
  isBulk?: boolean;
  inReplyToMessageId?: string | undefined;
}) {
  const sanitizedHeaders = sanitizeCustomHeaders(headers);
  const sanitizedHeaderNames = new Set(
    Object.keys(sanitizedHeaders ?? {}).map((name) => name.toLowerCase())
  );

  const defaultHeaders: Record<string, string> = {};

  if (!sanitizedHeaderNames.has("x-entity-ref-id")) {
    defaultHeaders["X-Entity-Ref-ID"] = nanoid();
  }

  if (emailId) {
    defaultHeaders["X-ByteSend-Email-ID"] = emailId;
  }

  if ((unsubUrl ?? unsubOneClickUrl) && !sanitizedHeaderNames.has("list-unsubscribe")) {
    if (unsubOneClickUrl && unsubUrl) {
      defaultHeaders["List-Unsubscribe"] = `<${unsubOneClickUrl}>, <${unsubUrl}>`;
    } else {
      defaultHeaders["List-Unsubscribe"] = `<${unsubOneClickUrl ?? unsubUrl}>`;
    }
  }

  if (unsubOneClickUrl && !sanitizedHeaderNames.has("list-unsubscribe-post")) {
    defaultHeaders["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  if (isBulk && !sanitizedHeaderNames.has("precedence")) {
    defaultHeaders["Precedence"] = "bulk";
  }

  if (inReplyToMessageId) {
    const formattedMessageId = `<${inReplyToMessageId}@email.amazonses.com>`;

    if (!sanitizedHeaderNames.has("in-reply-to")) {
      defaultHeaders["In-Reply-To"] = formattedMessageId;
    }

    if (!sanitizedHeaderNames.has("references")) {
      defaultHeaders["References"] = formattedMessageId;
    }
  }

  return {
    ...defaultHeaders,
    ...(sanitizedHeaders ?? {}),
  };
}
