import { randomUUID } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { SessionRegistry } from "../server/session-registry.js";
import { WsServer } from "../server/ws-server.js";
import { createMcpServer } from "../server/mcp-server.js";
import { ensureToken, getTokenPath } from "../utils/auth.js";

export interface ServerOptions {
  port?: string;
  wsPort?: string;
  debug?: boolean;
}

export async function serverAction(options: ServerOptions): Promise<void> {
  const mcpPort = parseInt(options.port || "3124", 10);
  const wsPort = parseInt(options.wsPort || "3101", 10);

  const token = ensureToken();
  const registry = new SessionRegistry();

  // Iniciar WebSocket server
  const wsServer = new WsServer(wsPort, registry, token);
  await wsServer.start();

  // App Express pre-configurada por el SDK (incluye json() y DNS rebinding protection)
  const app = createMcpExpressApp();

  // Map de transports por sesión MCP
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  // POST /mcp
  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    try {
      if (sessionId && transports[sessionId]) {
        await transports[sessionId].handleRequest(req, res, req.body);
        return;
      }

      if (!sessionId && isInitializeRequest(req.body)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            transports[sid] = transport;
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            delete transports[sid];
          }
        };

        const mcp = createMcpServer(registry);
        await mcp.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID" },
        id: null,
      });
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // GET /mcp (SSE streams)
  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).json({ error: "Invalid or missing session ID" });
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  // DELETE /mcp (session termination)
  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).json({ error: "Invalid or missing session ID" });
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  app.listen(mcpPort, () => {
    process.stderr.write(
      `[ssh-copilot] MCP Server listening on http://localhost:${mcpPort}/mcp\n`
    );
    process.stderr.write(
      `[ssh-copilot] WebSocket Server listening on ws://localhost:${wsPort}\n`
    );
    process.stderr.write(
      `[ssh-copilot] Auth token stored at ${getTokenPath()}\n`
    );
    process.stderr.write(`[ssh-copilot] Ready for connections.\n`);
  });

  // Shutdown limpio
  const shutdown = async () => {
    process.stderr.write("\n[ssh-copilot] Shutting down...\n");
    wsServer.stop();
    for (const sid of Object.keys(transports)) {
      await transports[sid].close();
      delete transports[sid];
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
