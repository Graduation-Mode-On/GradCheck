import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { HttpError } from "../lib/http-error.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ error: { message: error.message } });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({ error: { message: error.issues[0]?.message ?? "Invalid request body" } });
    return;
  }

  res.status(500).json({ error: { message: "Internal server error" } });
};
