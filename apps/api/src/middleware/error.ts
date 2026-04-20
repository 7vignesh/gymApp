import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  if (err instanceof AppError) {
    return c.json({ error: err.message, code: err.code ?? null }, err.status);
  }
  if (err instanceof ZodError) {
    return c.json(
      { error: "validation_failed", details: err.flatten() },
      422,
    );
  }
  console.error("[api] Unhandled error:", err);
  return c.json({ error: "internal_error" }, 500);
};
