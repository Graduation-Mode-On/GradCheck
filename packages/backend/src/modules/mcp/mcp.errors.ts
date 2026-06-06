import { ZodError } from "zod";

import { HttpError } from "../../lib/http-error.js";

export class McpError extends Error {
  constructor(
    public readonly code: number,
    message: string
  ) {
    super(message);
    this.name = "McpError";
  }
}

export function mcpError(code: number, message: string): McpError {
  return new McpError(code, message);
}

export function toMcpError(error: unknown): McpError {
  if (error instanceof McpError) {
    return error;
  }
  if (error instanceof ZodError) {
    return new McpError(-32602, error.issues[0]?.message ?? "Invalid parameters");
  }
  if (error instanceof HttpError) {
    return new McpError(error.statusCode === 401 ? -32001 : -32000, error.message);
  }
  return new McpError(-32000, error instanceof Error ? error.message : "Internal error");
}
