import type { WebSocket } from "ws";
import { ContextBuffer, type AgentContext } from "../context-buffer.js";

export interface SessionInfo {
  sessionId: string;
  destination: string;
  connectedAt: number;
  lastActivity: number;
}

export interface SessionEntry extends SessionInfo {
  ws: WebSocket;
  contextBuffer: ContextBuffer;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class SessionRegistry {
  private sessions = new Map<string, SessionEntry>();
  private pendingRequests = new Map<string, PendingRequest>();

  register(sessionId: string, destination: string, ws: WebSocket): void {
    const entry: SessionEntry = {
      sessionId,
      destination,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      ws,
      contextBuffer: new ContextBuffer(),
    };
    this.sessions.set(sessionId, entry);
  }

  unregister(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  get(sessionId: string): SessionEntry | undefined {
    return this.sessions.get(sessionId);
  }

  list(): SessionInfo[] {
    return Array.from(this.sessions.values()).map(
      ({ sessionId, destination, connectedAt, lastActivity }) => ({
        sessionId,
        destination,
        connectedAt,
        lastActivity,
      })
    );
  }

  updateActivity(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.lastActivity = Date.now();
    }
  }

  sendCommand(sessionId: string, command: string): Promise<{ status: string }> {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      return Promise.reject(new Error(`Session ${sessionId} not found`));
    }

    const requestId = crypto.randomUUID();
    const timeoutMs = 10000;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Command timeout (${timeoutMs / 1000}s waiting for client ack)`));
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      entry.ws.send(
        JSON.stringify({ type: "run_command", requestId, command })
      );
    });
  }

  readContext(sessionId: string): AgentContext | null {
    const entry = this.sessions.get(sessionId);
    if (!entry) return null;
    return entry.contextBuffer.getSnapshot();
  }

  resolveRequest(requestId: string, result: any): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);
      pending.resolve(result);
    }
  }

  rejectRequest(requestId: string, error: string): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);
      pending.reject(new Error(error));
    }
  }
}
