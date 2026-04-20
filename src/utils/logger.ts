import { writeFileSync, appendFileSync, existsSync } from "node:fs";

export class Logger {
  private debugMode: boolean;
  private logFile?: string;

  constructor(options: { debug: boolean; logFile?: string }) {
    this.debugMode = options.debug;
    this.logFile = options.logFile;

    if (this.logFile && existsSync(this.logFile)) {
      writeFileSync(this.logFile, "");
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (!this.debugMode) return;
    this.write("DEBUG", message, args);
  }

  info(message: string, ...args: unknown[]): void {
    this.write("INFO", message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.write("ERROR", message, args);
  }

  private write(level: string, message: string, args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const extra = args.length > 0 ? " " + JSON.stringify(args) : "";
    const line = `[${timestamp}] [${level}] ${message}${extra}\n`;

    if (this.logFile) {
      appendFileSync(this.logFile, line);
    } else {
      process.stderr.write(line);
    }
  }
}
