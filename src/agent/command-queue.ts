import type { AgentCommand } from "./types.js";

export class CommandQueue {
  private queue: AgentCommand[] = [];
  private processing = false;
  private idCounter = 0;

  enqueue(command: string): AgentCommand {
    const entry: AgentCommand = {
      id: String(++this.idCounter),
      command,
      timestamp: Date.now(),
      status: "pending",
    };
    this.queue.push(entry);
    return entry;
  }

  async processNext(
    writer: (data: string) => void
  ): Promise<AgentCommand | null> {
    if (this.processing || this.queue.length === 0) {
      return null;
    }

    this.processing = true;
    const entry = this.queue.shift()!;
    entry.status = "executing";

    const commandWithEnter = entry.command.endsWith("\r")
      ? entry.command
      : entry.command + "\r";

    writer(commandWithEnter);
    entry.status = "completed";
    this.processing = false;

    return entry;
  }

  async processAll(writer: (data: string) => void): Promise<void> {
    while (this.queue.length > 0) {
      await this.processNext(writer);
    }
  }

  get pending(): number {
    return this.queue.length;
  }

  get isProcessing(): boolean {
    return this.processing;
  }
}
