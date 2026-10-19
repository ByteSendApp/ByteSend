import { createHash, randomBytes } from "crypto";

const CODE_COUNT = 10;

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: CODE_COUNT }, () =>
    randomBytes(5).toString("hex").toUpperCase(),
  );
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code.toUpperCase().trim()).digest("hex");
}

export function verifyRecoveryCode(submitted: string, storedHash: string): boolean {
  const submittedHash = hashRecoveryCode(submitted);
  if (submittedHash.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < submittedHash.length; i++) {
    diff |= submittedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return diff === 0;
}
