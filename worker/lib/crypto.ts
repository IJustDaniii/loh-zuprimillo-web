const encoder = new TextEncoder();

// Cloudflare Workers rejects PBKDF2 iteration counts above 100,000.
// Keep this value explicit so the production constraint is covered by tests.
export const PASSWORD_HASH_ITERATIONS = 100_000;

export function randomToken(bytes = 32): string {
  const buffer = crypto.getRandomValues(new Uint8Array(bytes));
  return toBase64Url(buffer);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function sha256(value: string | ArrayBuffer): Promise<string> {
  const input = typeof value === "string" ? encoder.encode(value) : value;
  return toBase64Url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", input)),
  );
}

export async function hashPassword(
  password: string,
  salt = randomToken(16),
): Promise<{ hash: string; salt: string }> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromBase64Url(salt).buffer as ArrayBuffer,
      iterations: PASSWORD_HASH_ITERATIONS,
    },
    key,
    256,
  );
  return { hash: toBase64Url(new Uint8Array(bits)), salt };
}

export async function verifyPassword(
  password: string,
  salt: string,
  expected: string,
): Promise<boolean> {
  const actual = (await hashPassword(password, salt)).hash;
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i += 1)
    mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}
