import { randomUUID } from "node:crypto";

import { Router, type Request, type Response } from "express";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import type { McpDependencies } from "./mcp.context.js";
import { resolveUserId } from "./mcp.auth.js";
import { createMcpServer } from "./server.js";
import { toMcpError } from "./mcp.errors.js";
import { createRateLimiter } from "./rate-limit.js";

function jsonRpcError(res: Response, code: number, message: string, status = 200): void {
  res.status(status).json({ jsonrpc: "2.0", error: { code, message }, id: null });
}

export function createMcpRouter(deps: McpDependencies): Router {
  const router = Router();
  const transports = new Map<string, StreamableHTTPServerTransport>();
  const limiter = createRateLimiter(deps.rateLimitPerMinute, 60_000);

  router.post("/", async (req: Request, res: Response) => {
    try {
      const authHeader = req.header("Authorization");
      if (authHeader && !limiter.check(authHeader)) {
        const resetIso = new Date(limiter.resetAt(authHeader)).toISOString();
        jsonRpcError(res, -32000, `Rate limit exceeded. Try again after ${resetIso}`, 429);
        return;
      }

      const sessionId = req.header("Mcp-Session-Id");
      const existing = sessionId ? transports.get(sessionId) : undefined;

      if (existing) {
        await existing.handleRequest(req, res, req.body);
        return;
      }

      if (!isInitializeRequest(req.body)) {
        jsonRpcError(res, -32000, "No valid session. Send initialize first.", 400);
        return;
      }

      const userId = await resolveUserId(deps.authRepository, authHeader);
      const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id: string) => {
          transports.set(id, transport);
        }
      });
      transport.onclose = () => {
        if (transport.sessionId) transports.delete(transport.sessionId);
      };
      const server = createMcpServer({ userId }, deps);
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      const mapped = toMcpError(error);
      if (!res.headersSent) jsonRpcError(res, mapped.code, mapped.message);
    }
  });

  const handleSessionRequest = async (req: Request, res: Response) => {
    const sessionId = req.header("Mcp-Session-Id");
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
      res.status(400).send("Invalid or missing session id");
      return;
    }
    await transport.handleRequest(req, res);
  };

  router.get("/", handleSessionRequest);
  router.delete("/", handleSessionRequest);

  return router;
}
