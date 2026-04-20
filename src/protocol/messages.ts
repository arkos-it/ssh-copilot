import type { AgentContext } from "../context-buffer.js";

// --- Client → Server ---

export interface RegisterMessage {
  type: "register";
  sessionId: string;
  destination: string;
  connectedAt: number;
}

export interface OutputMessage {
  type: "output";
  sessionId: string;
  data: string;
}

export interface CommandDetectedMessage {
  type: "command";
  sessionId: string;
  command: string;
}

export interface CommandResultMessage {
  type: "command_result";
  sessionId: string;
  requestId: string;
  status: "sent" | "error" | "rejected";
  error?: string;
}

export interface ContextSnapshotMessage {
  type: "context_snapshot";
  sessionId: string;
  requestId: string;
  snapshot: AgentContext;
}

export interface DisconnectMessage {
  type: "disconnect";
  sessionId: string;
}

// --- Server → Client ---

export interface RunCommandMessage {
  type: "run_command";
  requestId: string;
  command: string;
}

export interface ReadContextMessage {
  type: "read_context";
  requestId: string;
}

// --- Union types ---

export type ClientMessage =
  | RegisterMessage
  | OutputMessage
  | CommandDetectedMessage
  | CommandResultMessage
  | ContextSnapshotMessage
  | DisconnectMessage;

export type ServerMessage = RunCommandMessage | ReadContextMessage;
