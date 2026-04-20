import WebSocket from "ws";
import type { AgentContext } from "../context-buffer.js";
import type {
  ClientMessage,
  ServerMessage,
} from "../protocol/messages.js";

export class WsClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private sessionId: string;
  private destination: string;
  private token: string;

  onRunCommand?: (command: string, requestId: string) => void;
  onReadContext?: (requestId: string) => void;

  constructor(
    serverUrl: string,
    sessionId: string,
    destination: string,
    token: string
  ) {
    this.serverUrl = serverUrl;
    this.sessionId = sessionId;
    this.destination = destination;
    this.token = token;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.serverUrl);
      url.searchParams.set("token", this.token);
      this.ws = new WebSocket(url.toString());

      const timeout = setTimeout(() => {
        this.ws?.terminate();
        reject(new Error("Connection timeout"));
      }, 5000);

      this.ws.on("open", () => {
        clearTimeout(timeout);

        // Registrar sesión
        this.send({
          type: "register",
          sessionId: this.sessionId,
          destination: this.destination,
          connectedAt: Date.now(),
        });

        resolve();
      });

      this.ws.on("message", (raw: Buffer) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }

        switch (msg.type) {
          case "run_command":
            this.onRunCommand?.(msg.command, msg.requestId);
            break;
          case "read_context":
            this.onReadContext?.(msg.requestId);
            break;
        }
      });

      this.ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  sendOutput(data: string): void {
    this.send({
      type: "output",
      sessionId: this.sessionId,
      data,
    });
  }

  sendCommand(command: string): void {
    this.send({
      type: "command",
      sessionId: this.sessionId,
      command,
    });
  }

  sendCommandResult(
    requestId: string,
    status: "sent" | "pending_approval" | "error" | "rejected",
    error?: string
  ): void {
    this.send({
      type: "command_result",
      sessionId: this.sessionId,
      requestId,
      status,
      error,
    });
  }

  sendContextSnapshot(requestId: string, snapshot: AgentContext): void {
    this.send({
      type: "context_snapshot",
      sessionId: this.sessionId,
      requestId,
      snapshot,
    });
  }

  disconnect(): void {
    this.send({
      type: "disconnect",
      sessionId: this.sessionId,
    });
    this.ws?.close();
  }

  private send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
