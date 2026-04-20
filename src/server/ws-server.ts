import { WebSocketServer, type WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { SessionRegistry } from "./session-registry.js";
import type { ClientMessage } from "../protocol/messages.js";

export class WsServer {
  private wss: WebSocketServer | null = null;
  private registry: SessionRegistry;
  private port: number;
  private token: string;

  constructor(port: number, registry: SessionRegistry, token: string) {
    this.port = port;
    this.registry = registry;
    this.token = token;
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer(
        { port: this.port, host: "127.0.0.1" },
        () => {
          resolve();
        }
      );

      this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
        if (!this.isAuthorized(req)) {
          process.stderr.write(
            `[ssh-copilot] Unauthorized WS connection rejected from ${req.socket.remoteAddress}\n`
          );
          ws.close(1008, "unauthorized");
          return;
        }

        let sessionId: string | null = null;

        ws.on("message", (raw: Buffer) => {
          let msg: ClientMessage;
          try {
            msg = JSON.parse(raw.toString());
          } catch {
            return;
          }

          switch (msg.type) {
            case "register":
              sessionId = msg.sessionId;
              this.registry.register(msg.sessionId, msg.destination, ws);
              process.stderr.write(
                `[ssh-copilot] Session registered: ${msg.sessionId} (${msg.destination})\n`
              );
              break;

            case "output":
              if (msg.sessionId) {
                const entry = this.registry.get(msg.sessionId);
                if (entry) {
                  entry.contextBuffer.appendOutput(msg.data);
                  this.registry.updateActivity(msg.sessionId);
                }
              }
              break;

            case "command":
              if (msg.sessionId) {
                const entry = this.registry.get(msg.sessionId);
                if (entry) {
                  entry.contextBuffer.addCommand(msg.command);
                  this.registry.updateActivity(msg.sessionId);
                }
              }
              break;

            case "command_result":
              if (msg.status === "sent") {
                this.registry.resolveRequest(msg.requestId, {
                  status: "sent",
                });
              } else {
                this.registry.rejectRequest(
                  msg.requestId,
                  msg.error || "Unknown error"
                );
              }
              break;

            case "context_snapshot":
              this.registry.resolveRequest(msg.requestId, msg.snapshot);
              break;

            case "disconnect":
              if (msg.sessionId) {
                this.registry.unregister(msg.sessionId);
                process.stderr.write(
                  `[ssh-copilot] Session disconnected: ${msg.sessionId}\n`
                );
              }
              break;
          }
        });

        ws.on("close", () => {
          if (sessionId) {
            this.registry.unregister(sessionId);
            process.stderr.write(
              `[ssh-copilot] Session lost: ${sessionId}\n`
            );
          }
        });
      });
    });
  }

  private isAuthorized(req: IncomingMessage): boolean {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const provided = url.searchParams.get("token") ?? "";
    const expected = this.token;

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  stop(): void {
    this.wss?.close();
  }
}
