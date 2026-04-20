export interface AgentContext {
  recentOutput: string;
  recentCommands: string[];
  timestamp: number;
}

const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, "");
}

export class ContextBuffer {
  private lines: string[] = [];
  private commands: string[] = [];
  private maxLines: number;
  private maxCommands: number;
  private partialLine = "";

  constructor(maxLines = 100, maxCommands = 50) {
    this.maxLines = maxLines;
    this.maxCommands = maxCommands;
  }

  appendOutput(data: string): void {
    const clean = stripAnsi(data);
    this.partialLine += clean;

    const parts = this.partialLine.split("\n");
    // La última parte puede ser una línea incompleta
    this.partialLine = parts.pop() ?? "";

    for (const line of parts) {
      const trimmed = line.trimEnd();
      if (trimmed.length > 0) {
        this.lines.push(trimmed);
        if (this.lines.length > this.maxLines) {
          this.lines.shift();
        }
      }
    }
  }

  addCommand(command: string): void {
    const trimmed = command.trim();
    if (trimmed.length > 0) {
      this.commands.push(trimmed);
      if (this.commands.length > this.maxCommands) {
        this.commands.shift();
      }
    }
  }

  getRecentLines(n?: number): string[] {
    const count = n ?? this.maxLines;
    return this.lines.slice(-count);
  }

  getRecentCommands(n?: number): string[] {
    const count = n ?? this.maxCommands;
    return this.commands.slice(-count);
  }

  getSnapshot(): AgentContext {
    return {
      recentOutput: this.getRecentLines(50).join("\n"),
      recentCommands: this.getRecentCommands(20),
      timestamp: Date.now(),
    };
  }

  clear(): void {
    this.lines = [];
    this.commands = [];
    this.partialLine = "";
  }
}
