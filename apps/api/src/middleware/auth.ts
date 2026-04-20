import type { MiddlewareHandler } from "hono";
import { verifyToken } from "../services/auth.service";
import { AppError } from "./error";

export interface AuthContext {
  Variables: {
    userId: string;
    email: string;
  };
}

/** Require a valid JWT; attaches userId + email to context. */
export const requireAuth: MiddlewareHandler<AuthContext> = async (c, next) => {
  const header = c.req.header("authorization") ?? c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new AppError(401, "missing_token");

  try {
    const payload = await verifyToken(token);
    c.set("userId", payload.sub);
    c.set("email", payload.email);
  } catch {
    throw new AppError(401, "invalid_token");
  }
  await next();
};
