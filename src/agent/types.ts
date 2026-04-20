import type { AgentContext } from "../context-buffer.js";

export interface IAgent {
  sendOutput(output: string): void;
  addCommand(command: string): void;
  getContext(): AgentContext | null;
}

export interface AgentCommand {
  id: string;
  command: string;
  timestamp: number;
  status: "pending" | "executing" | "completed";
}
