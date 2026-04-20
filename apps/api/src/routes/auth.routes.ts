/**
 * Auth routes:
 *   GET  /auth/google         → redirect to Google OAuth consent screen
 *   GET  /auth/google/callback → exchange code, issue JWT, redirect to web
 *   POST /auth/dev-login      → dev-only: issue a token for a fake user
 *   GET  /auth/me             → return current user (requires auth)
 */
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@calai/db";
import { env } from "../env";
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  signToken,
  upsertUserFromGoogle,
} from "../services/auth.service";
import { requireAuth, type AuthContext } from "../middleware/auth";
import { AppError } from "../middleware/error";

export const authRoutes = new Hono<AuthContext>();

authRoutes.get("/google", (c) => {
  const state = crypto.randomUUID();
  const url = buildGoogleAuthUrl(state);
  return c.redirect(url);
});

authRoutes.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) throw new AppError(400, "missing_code");

  const info = await exchangeGoogleCode(code);
  if (!info.email_verified) throw new AppError(401, "email_not_verified");

  const user = await upsertUserFromGoogle(info);
  const token = await signToken({ sub: user.id, email: user.email });

  // Redirect to frontend with token in URL hash (the SPA stores it).
  const redirectUrl = `${env.WEB_URL}/auth/callback#token=${encodeURIComponent(token)}`;
  return c.redirect(redirectUrl);
});

/**
 * Dev-only login: returns a JWT for a seeded user so you can exercise the
 * API locally without Google OAuth credentials. Disabled in production.
 */
authRoutes.post(
  "/dev-login",
  zValidator("json", z.object({ email: z.string().email() }).optional()),
  async (c) => {
    if (env.NODE_ENV === "production") throw new AppError(403, "disabled_in_production");
    const body = c.req.valid("json") ?? { email: "dev@calai.local" };
    const email = body.email ?? "dev@calai.local";

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: "Dev User" },
    });
    const token = await signToken({ sub: user.id, email: user.email });
    return c.json({ token, user });
  },
);

authRoutes.get("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "user_not_found");
  return c.json({ user });
});
