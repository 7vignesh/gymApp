/**
 * Auth service — Google OAuth + JWT issuance/verification.
 * Uses `jose` for JWT (edge-safe, works on Bun).
 */
import { SignJWT, jwtVerify } from "jose";
import { env } from "../env";
import { prisma } from "@calai/db";
import { AppError } from "../middleware/error";

const JWT_ALG = "HS256";
const JWT_ISSUER = "calai-api";
const JWT_AUDIENCE = "calai-web";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface JwtPayload {
  sub: string;
  email: string;
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: JWT_ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secret, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
  if (!payload.sub || typeof payload.email !== "string") {
    throw new Error("invalid_payload");
  }
  return { sub: payload.sub, email: payload.email };
}

// ----- Google OAuth helpers -----

export function buildGoogleAuthUrl(state: string): string {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError(500, "google_oauth_not_configured");
  }
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

export async function exchangeGoogleCode(code: string): Promise<GoogleUserInfo> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new AppError(401, `google_token_exchange_failed: ${text}`);
  }

  const tokens = (await tokenRes.json()) as GoogleTokenResponse;

  const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userRes.ok) throw new AppError(401, "google_userinfo_failed");
  return (await userRes.json()) as GoogleUserInfo;
}

/** Idempotent user upsert keyed by googleId / email. */
export async function upsertUserFromGoogle(info: GoogleUserInfo) {
  return prisma.user.upsert({
    where: { email: info.email },
    update: {
      googleId: info.sub,
      name: info.name ?? null,
      image: info.picture ?? null,
    },
    create: {
      email: info.email,
      googleId: info.sub,
      name: info.name ?? null,
      image: info.picture ?? null,
    },
  });
}
