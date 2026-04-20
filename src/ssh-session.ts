import * as pty from "node-pty";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { TerminalManager } from "./terminal.js";
import type { IAgent } from "./agent/types.js";
import type { CommandQueue } from "./agent/command-queue.js";
import type { ModeManager } from "./mode-manager.js";

function findSshBinary(): string {
  if (process.platform === "win32") {
    const windowsSsh = "C:\\Windows\\System32\\OpenSSH\\ssh.exe";
    if (existsSync(windowsSsh)) return windowsSsh;
  }
  return "ssh";
}

export interface SshSessionOptions {
  sshArgs: string[];
  agent: IAgent;
  commandQueue: CommandQueue;
  modeManager?: ModeManager;
  debug?: boolean;
}

export class SshSession {
  private ptyProcess: pty.IPty | null = null;
  private terminal: TerminalManager;
  private options: SshSessionOptions;
  private userInputBuffer = "";

  constructor(options: SshSessionOptions) {
    this.options = options;
    this.terminal = new TerminalManager();
  }

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        const sshBin = findSshBinary();
        this.ptyProcess = pty.spawn(sshBin, this.options.sshArgs, {
          name: "xterm-256color",
          cols: this.terminal.cols,
          rows: this.terminal.rows,
          cwd: process.cwd(),
          env: process.env as Record<string, string>,
        });
      } catch (err) {
        reject(err);
        return;
      }

      // PTY output → usuario + agente
      this.ptyProcess.onData((data: string) => {
        process.stdout.write(data);
        try {
          this.options.agent.sendOutput(data);
        } catch {
          // No romper el terminal si el agente falla
        }
      });

      // Usuario input → PTY
      const onStdinData = (data: Buffer) => {
        if (!this.ptyProcess) return;
        const str = data.toString();

        // Ctrl+O → cambiar modo
        if (str === "\x0F" && this.options.modeManager) {
          this.options.modeManager.cycleMode();
          return;
        }

        // Si hay aprobación pendiente, interceptar y/n
        if (this.options.modeManager?.hasPendingApproval()) {
          if (this.options.modeManager.handleApprovalInput(str)) {
            return;
          }
        }

        this.ptyProcess.write(str);

        // Detectar comandos (cuando el usuario presiona Enter)
        if (str === "\r" || str === "\n") {
          const command = this.userInputBuffer.trim();
          if (command.length > 0) {
            try {
              this.options.agent.addCommand(command);
            } catch {
              // No romper el terminal si el agente falla
            }
          }
          this.userInputBuffer = "";
        } else if (str === "\x7f" || str === "\b") {
          // Backspace
          this.userInputBuffer = this.userInputBuffer.slice(0, -1);
        } else if (str.length === 1 && str >= " ") {
          // Caracteres imprimibles
          this.userInputBuffer += str;
        }
      };
      process.stdin.on("data", onStdinData);

      // Resize
      this.terminal.onResize((cols, rows) => {
        this.ptyProcess?.resize(cols, rows);
      });

      // Setup terminal (raw mode)
      this.terminal.setup();

      // Mostrar modo inicial
      this.options.modeManager?.updateTitle();

      // PTY exit
      this.ptyProcess.onExit(({ exitCode }) => {
        process.stdin.removeListener("data", onStdinData);
        this.terminal.restore();
        resolve(exitCode);
      });
    });
  }

  writeToTerminal(data: string): void {
    this.ptyProcess?.write(data);
  }

  async executeAgentCommand(command: string): Promise<void> {
    this.options.commandQueue.enqueue(command);
    await this.options.commandQueue.processNext((data) =>
      this.writeToTerminal(data)
    );
  }

  dispose(): void {
    this.ptyProcess?.kill();
    this.terminal.restore();
  }
}
