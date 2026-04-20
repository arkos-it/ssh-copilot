export interface LineEntry {
  id: number;
  text: string;
}

export interface CommandEntry {
  command: string;
  at_line_id: number;
  timestamp: number;
}

export interface ReadOptions {
  lines?: number;
  offset?: number;
  since_id?: number;
  last_commands?: number;
}

export interface ReadResult {
  lines: LineEntry[];
  commands: CommandEntry[];
  oldest_available_id: number | null;
  latest_id: number | null;
  total_lines_in_buffer: number;
  filtered_by_command?: CommandEntry | null;
}

export interface SearchOptions {
  pattern: string;
  flags?: string;
  max_matches?: number;
  context_lines?: number;
}

export interface SearchMatch {
  id: number;
  text: string;
  before?: string[];
  after?: string[];
}

export interface SearchResult {
  matches: SearchMatch[];
  truncated: boolean;
  total_lines_searched: number;
}

export interface AgentContext {
  recentOutput: string;
  recentCommands: string[];
  timestamp: number;
}

const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, "");
}

const READ_LINES_DEFAULT = 50;
const READ_LINES_MAX = 500;
const SEARCH_MATCHES_DEFAULT = 20;
const SEARCH_MATCHES_MAX = 100;
const SEARCH_PATTERN_MAX_LEN = 256;
const SEARCH_CONTEXT_MAX = 10;

export class ContextBuffer {
  private static readonly MAX_PARTIAL = 4096;

  private entries: LineEntry[] = [];
  private commands: CommandEntry[] = [];
  private nextId = 0;
  private maxLines: number;
  private maxCommands: number;
  private partialLine = "";

  constructor(maxLines = 1000, maxCommands = 50) {
    this.maxLines = maxLines;
    this.maxCommands = maxCommands;
  }

  appendOutput(data: string): void {
    const clean = stripAnsi(data);
    this.partialLine += clean;

    const parts = this.partialLine.split("\n");
    let tail = parts.pop() ?? "";
    if (tail.length > ContextBuffer.MAX_PARTIAL) {
      tail = tail.slice(-ContextBuffer.MAX_PARTIAL);
    }
    this.partialLine = tail;

    for (const line of parts) {
      const trimmed = line.trimEnd();
      if (trimmed.length > 0) {
        this.entries.push({ id: this.nextId++, text: trimmed });
        if (this.entries.length > this.maxLines) {
          this.entries.shift();
        }
      }
    }
  }

  addCommand(command: string): void {
    const trimmed = command.trim();
    if (trimmed.length > 0) {
      this.commands.push({
        command: trimmed,
        at_line_id: this.nextId,
        timestamp: Date.now(),
      });
      if (this.commands.length > this.maxCommands) {
        this.commands.shift();
      }
    }
  }

  read(opts: ReadOptions = {}): ReadResult {
    const requested = opts.lines ?? READ_LINES_DEFAULT;
    const lines = Math.max(1, Math.min(requested, READ_LINES_MAX));
    const offset = Math.max(0, opts.offset ?? 0);

    let pool = this.entries;
    let filteredBy: CommandEntry | null | undefined;

    if (typeof opts.last_commands === "number" && opts.last_commands > 0) {
      const targetIdx = this.commands.length - opts.last_commands;
      if (targetIdx >= 0) {
        const target = this.commands[targetIdx];
        filteredBy = target;
        pool = pool.filter((e) => e.id >= target.at_line_id);
      } else {
        filteredBy = null;
      }
    }

    if (typeof opts.since_id === "number") {
      pool = pool.filter((e) => e.id > opts.since_id!);
    }

    const total = pool.length;
    const end = total - offset;
    const start = Math.max(0, end - lines);
    const slice = end > 0 ? pool.slice(start, end) : [];

    const result: ReadResult = {
      lines: slice,
      commands: [...this.commands],
      oldest_available_id: this.entries.length > 0 ? this.entries[0].id : null,
      latest_id:
        this.entries.length > 0
          ? this.entries[this.entries.length - 1].id
          : null,
      total_lines_in_buffer: this.entries.length,
    };
    if (filteredBy !== undefined) {
      result.filtered_by_command = filteredBy;
    }
    return result;
  }

  search(opts: SearchOptions): SearchResult {
    if (opts.pattern.length > SEARCH_PATTERN_MAX_LEN) {
      throw new Error(
        `Pattern too long (max ${SEARCH_PATTERN_MAX_LEN} chars)`
      );
    }

    const flags = opts.flags ?? "i";
    let regex: RegExp;
    try {
      regex = new RegExp(opts.pattern, flags);
    } catch (err) {
      throw new Error(`Invalid regex: ${(err as Error).message}`);
    }

    const maxMatches = Math.max(
      1,
      Math.min(opts.max_matches ?? SEARCH_MATCHES_DEFAULT, SEARCH_MATCHES_MAX)
    );
    const contextLines = Math.max(
      0,
      Math.min(opts.context_lines ?? 0, SEARCH_CONTEXT_MAX)
    );

    const matches: SearchMatch[] = [];
    let truncated = false;

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      if (regex.test(entry.text)) {
        const match: SearchMatch = { id: entry.id, text: entry.text };
        if (contextLines > 0) {
          match.before = this.entries
            .slice(Math.max(0, i - contextLines), i)
            .map((e) => e.text);
          match.after = this.entries
            .slice(i + 1, i + 1 + contextLines)
            .map((e) => e.text);
        }
        matches.push(match);
        if (matches.length >= maxMatches) {
          truncated = i < this.entries.length - 1;
          break;
        }
      }
    }

    return {
      matches,
      truncated,
      total_lines_searched: this.entries.length,
    };
  }

  getSnapshot(): AgentContext {
    const lines = this.entries.slice(-50).map((e) => e.text);
    return {
      recentOutput: lines.join("\n"),
      recentCommands: this.commands.slice(-20).map((c) => c.command),
      timestamp: Date.now(),
    };
  }

  clear(): void {
    this.entries = [];
    this.commands = [];
    this.partialLine = "";
  }
}
