import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SessionRegistry } from "./session-registry.js";

export function createMcpServer(registry: SessionRegistry): McpServer {
  const mcp = new McpServer({
    name: "ssh-copilot",
    version: "0.1.0",
  });

  mcp.tool(
    "list_sessions",
    "Lista todas las sesiones SSH activas conectadas al server",
    {},
    async () => {
      const sessions = registry.list();
      return {
        content: [
          { type: "text", text: JSON.stringify(sessions, null, 2) },
        ],
      };
    }
  );

  mcp.tool(
    "read_terminal",
    "Lee output reciente de una sesión SSH. Soporta paginación (offset, lines), deltas (since_id) y filtrado por comando (last_commands: 1 = desde el último comando del usuario).",
    {
      session_id: z.string().describe("ID de la sesión SSH"),
      lines: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .describe("Cuántas líneas devolver (default 50, max 500)"),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Saltar N líneas desde el final (default 0)"),
      since_id: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Devolver solo líneas con id > since_id (deltas)"),
      last_commands: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe(
          "Filtrar a líneas producidas desde el Nth-to-last comando (1 = último)"
        ),
    },
    async ({ session_id, lines, offset, since_id, last_commands }) => {
      const entry = registry.get(session_id);
      if (!entry) {
        return {
          content: [
            { type: "text", text: `Error: Session '${session_id}' not found` },
          ],
          isError: true,
        };
      }
      const result = entry.contextBuffer.read({
        lines,
        offset,
        since_id,
        last_commands,
      });
      return {
        content: [
          { type: "text", text: JSON.stringify(result, null, 2) },
        ],
      };
    }
  );

  mcp.tool(
    "search_terminal",
    "Busca un patrón regex en el buffer de output de una sesión SSH. Útil para encontrar errores, IPs, patrones específicos.",
    {
      session_id: z.string().describe("ID de la sesión SSH"),
      pattern: z
        .string()
        .max(256)
        .describe("Regex a buscar (max 256 chars)"),
      flags: z
        .string()
        .max(8)
        .optional()
        .describe("Flags del regex (default 'i' = case-insensitive)"),
      max_matches: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Máximo de matches a devolver (default 20)"),
      context_lines: z
        .number()
        .int()
        .min(0)
        .max(10)
        .optional()
        .describe("Líneas de contexto antes/después de cada match (default 0)"),
    },
    async ({ session_id, pattern, flags, max_matches, context_lines }) => {
      const entry = registry.get(session_id);
      if (!entry) {
        return {
          content: [
            { type: "text", text: `Error: Session '${session_id}' not found` },
          ],
          isError: true,
        };
      }
      try {
        const result = entry.contextBuffer.search({
          pattern,
          flags,
          max_matches,
          context_lines,
        });
        return {
          content: [
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (err) {
        return {
          content: [
            { type: "text", text: `Error: ${(err as Error).message}` },
          ],
          isError: true,
        };
      }
    }
  );

  mcp.tool(
    "run_command",
    "Ejecuta un comando en una sesión SSH remota. Devuelve status: 'sent' (YOLO, ya se ejecutó), 'pending_approval' (SUGGEST, hay que avisarle al humano que revise su terminal y apruebe con y/n), 'rejected' (READONLY o usuario rechazó), 'error' (otros). El output nunca viene en la respuesta — usar read_terminal con last_commands para leerlo una vez que el comando haya corrido.",
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
            { type: "text", text: `Error: ${(err as Error).message}` },
          ],
          isError: true,
        };
      }
    }
  );

  return mcp;
}
