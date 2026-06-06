import type { AuthRepository } from "../auth/auth.repository.js";
import { getCurrentUser, verifyToken } from "../auth/auth.service.js";
import { mcpError } from "./mcp.errors.js";

export async function resolveUserId(
  repository: AuthRepository,
  authorization: string | undefined
): Promise<string> {
  if (!authorization?.startsWith("Bearer ")) {
    throw mcpError(-32001, "Authorization bearer token is required");
  }
  const token = authorization.slice("Bearer ".length);
  try {
    const userId = verifyToken(token);
    await getCurrentUser(repository, userId);
    return userId;
  } catch {
    throw mcpError(-32001, "Invalid or expired token");
  }
}
