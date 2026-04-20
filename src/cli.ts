import { Command } from "commander";
import { connectAction } from "./commands/connect.js";

const program = new Command();

program
  .name("ssh-copilot")
  .description("SSH copilot - terminal compartida entre humano y agente IA")
  .version("0.1.0")
  .enablePositionalOptions();

// Subcomando: connect
program
  .command("connect")
  .description("Abre una sesión SSH y la registra en el server MCP")
  .argument("<destination>", "SSH destination (user@host)")
  .option("-p, --port <port>", "puerto SSH")
  .option("-i, --identity <file>", "archivo de identidad SSH")
  .option("--debug", "modo debug")
  .option("--agent-debug", "muestra lo que el agente ve")
  .option("--server-url <url>", "URL del server MCP WebSocket", "ws://127.0.0.1:3101")
  .passThroughOptions()
  .action(connectAction);

// Subcomando: server
program
  .command("server")
  .description("Levanta el MCP server central")
  .option("--port <port>", "puerto del MCP server HTTP", "3124")
  .option("--ws-port <port>", "puerto del WebSocket server", "3101")
  .option("--debug", "modo debug")
  .action(async (options) => {
    const { serverAction } = await import("./commands/server.js");
    await serverAction(options);
  });

program.parse();
