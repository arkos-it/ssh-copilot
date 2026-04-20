import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SessionRegistry } from "./session-registry.js";

export function createMcpServer(registry: SessionRegistry): McpServer {
  const mcp = new McpServer({
    name: "ssh-copilot",
    version: "0.1.0",
  });

  // Tool: list_sessions
  mcp.tool(
    "list_sessions",
    "Lista todas las sesiones SSH activas conectadas al server",
    {},
    async () => {
      const sessions = registry.list();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(sessions, null, 2),
          },
        ],
      };
    }
  );

  // Tool: read_terminal
  mcp.tool(
    "read_terminal",
    "Lee el output reciente y los últimos comandos de una sesión SSH",
    {
      session_id: z.string().describe("ID de la sesión SSH"),
    },
    async ({ session_id }) => {
      const context = registry.readContext(session_id);
      if (!context) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Session '${session_id}' not found`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(context, null, 2),
          },
        ],
      };
    }
  );

  // Tool: run_command
  mcp.tool(
    "run_command",
    "Ejecuta un comando en una sesión SSH remota",
    {
      session_id: z.string().describe("ID de la sesión SSH"),
      command: z.string().describe("Comando a ejecutar"),
    },
    async ({ session_id, command }) => {
      try {
        const result = await registry.sendCommand(session_id, command);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: result.status,
                session_id,
                command,
              }),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return mcp;
}
