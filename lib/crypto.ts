import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt, type JWTPayload } from "jose";
import { tokenSecret } from "./config";

/**
 * Every token this server hands out (client ids for dynamically registered
 * clients, OAuth state, authorization codes, access and refresh tokens) is an
 * encrypted JWT (JWE, dir + A256GCM). Nothing is stored server-side: the
 * token itself carries the Concept2 credentials, and only this server can read
 * or forge one. Rotating TOKEN_SECRET invalidates all of them at once.
 */
export type TokenKind = "client" | "state" | "code" | "access" | "refresh";

let cachedKey: { secret: string; key: Uint8Array } | undefined;

function key(): Uint8Array {
  const secret = tokenSecret();
  if (cachedKey?.secret !== secret) {
    const digest = createHash("sha256").update(`ergdata-mcp:v1:${secret}`).digest();
    cachedKey = { secret, key: new Uint8Array(digest) };
  }
  return cachedKey.key;
}

export async function seal(
  kind: TokenKind,
  payload: Record<string, unknown>,
  ttlSeconds: number,
): Promise<string> {
  return new EncryptJWT({ ...payload, knd: kind })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .encrypt(key());
}

/** Decrypts a token of the given kind. Returns undefined if it is invalid, expired or another kind. */
export async function open<T extends object>(
  kind: TokenKind,
  token: string | undefined | null,
): Promise<(T & JWTPayload) | undefined> {
  if (!token) return undefined;
  try {
    const { payload } = await jwtDecrypt(token, key(), {
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });
    if (payload.knd !== kind) return undefined;
    return payload as T & JWTPayload;
  } catch {
    return undefined;
  }
}
