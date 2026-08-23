import { randomInt } from "crypto";

/** Exclude 0/1/I/O to avoid spoken/typed activation-code ambiguity. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const PIN_PREFIX = "BUS";
export const DEMO_PIN_CODE = "BUS-DEMO-0001";

/** Crypto-secure alphanumeric chunk for activation PIN codes. */
export function randomPinChunk(length = 4): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)]!;
  }
  return out;
}

export function generateActivationCode(): string {
  return `${PIN_PREFIX}-${randomPinChunk()}-${randomPinChunk()}`;
}

/** Demo / review PINs are off unless explicitly enabled. */
export function allowDemoPins(): boolean {
  return process.env.ALLOW_DEMO_PINS === "true";
}

export function isDemoPinCode(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  return normalized.startsWith("BUS-DEMO-") || normalized.startsWith("FINPA-DEMO-");
}
