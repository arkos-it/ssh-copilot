import type { Command } from "commander";
import { parseSshTarget, buildSshArgs } from "../utils/ssh-parser.js";
import { SshSession } from "../ssh-session.js";
import { ContextBuffer } from "../context-buffer.js";
import { AgentStub } from "../agent/agent-stub.js";
import { RemoteAgent } from "../agent/remote-agent.js";
import { CommandQueue } from "../agent/command-queue.js";
import { WsClient } from "../client/ws-client.js";
import { ModeManager, AgentMode } from "../mode-manager.js";
import { Logger } from "../utils/logger.js";
import { readToken } from "../utils/auth.js";
import type { IAgent } from "../agent/types.js";
import type { CliOptions } from "../utils/ssh-parser.js";

export interface ConnectOptions extends CliOptions {
  serverUrl?: string;
}

export async function connectAction(
  destination: string,
  options: ConnectOptions,
  command: Command
): Promise<void> {
  const target = parseSshTarget(destination);
  const extraArgs = command.args.slice(1);
  const sshArgs = buildSshArgs(target, options, extraArgs);

  const isDebug = options.debug || options.agentDebug || false;
  const logger = new Logger({
    debug: isDebug,
    logFile: isDebug ? "ssh-copilot.log" : undefined,
  });

  const contextBuffer = new ContextBuffer();
  const commandQueue = new CommandQueue();
  const modeManager = new ModeManager(destination);
  const serverUrl = options.serverUrl || "ws://127.0.0.1:3101";

  // Intentar conectar al server MCP, fallback a AgentStub
  let agent: IAgent;
  let wsClient: WsClient | null = null;

  try {
    const token = readToken();
    const sessionId = crypto.randomUUID();
    wsClient = new WsClient(serverUrl, sessionId, destination, token);
    await wsClient.connect();

    agent = new RemoteAgent(contextBuffer, wsClient, logger);
    logger.debug("Conectado al server MCP en", serverUrl);
    modeManager.showBanner();
  } catch (err) {
    agent = new AgentStub(contextBuffer, logger);
    wsClient = null;
    logger.debug(
      "Server MCP no disponible, modo local:",
      (err as Error).message
    );
  }

  const session = new SshSession({
    sshArgs,
    agent,
    commandQueue,
    modeManager,
    debug: isDebug,
  });

  // Registrar handlers de WebSocket si está conectado
  if (wsClient) {
    const client = wsClient;

    const executeCommand = (cmd: string) => {
      agent.addCommand(cmd);
      session.writeToTerminal(cmd + "\r");
    };

    client.onRunCommand = async (cmd, requestId) => {
      try {
        if (modeManager.currentMode === AgentMode.YOLO) {
          executeCommand(cmd);
          client.sendCommandResult(requestId, "sent");
          return;
        }

        if (modeManager.currentMode === AgentMode.READONLY) {
          client.sendCommandResult(
            requestId,
            "rejected",
            "Session is in readonly mode"
          );
          return;
        }

        // SUGGEST: respondemos al agente de inmediato con "pending_approval".
        // El agente sigue con su vida y puede avisar al humano que revise
        // su terminal. Esperamos la decisión en paralelo sin bloquear.
        client.sendCommandResult(requestId, "pending_approval");
        const approved = await modeManager.requestApproval(cmd);
        if (approved) {
          executeCommand(cmd);
        }
      } catch (err) {
        client.sendCommandResult(requestId, "error", (err as Error).message);
      }
    };

    client.onReadContext = (requestId) => {
      const snapshot = agent.getContext()!;
      client.sendContextSnapshot(requestId, snapshot);
    };

    process.on("exit", () => client.disconnect());
  }

  const cleanup = () => session.dispose();
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("uncaughtException", (err) => {
    cleanup();
    console.error("Error inesperado:", err.message);
    process.exit(1);
  });

  try {
    logger.debug("Iniciando sesión SSH", sshArgs);
    const exitCode = await session.start();
    logger.debug("Sesión terminada con código", exitCode);
    process.exit(exitCode);
  } catch (err) {
    console.error("Error al iniciar sesión SSH:", (err as Error).message);
    process.exit(1);
  }
}
