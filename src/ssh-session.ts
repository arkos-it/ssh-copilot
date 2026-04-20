import * as pty from "node-pty";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { TerminalManager } from "./terminal.js";
import type { IAgent } from "./agent/types.js";
import type { CommandQueue } from "./agent/command-queue.js";
import type { ModeManager } from "./mode-manager.js";

const WIN32_INPUT_REGEX = /\x1b\[(\d+);(\d+);(\d+);(\d+);(\d+);(\d+)_/g;
const CSI_U_REGEX = /\x1b\[(\d+)(?:;\d+)?u/;

// Intenta extraer el carácter que el usuario presionó, independiente del
// protocolo del terminal:
//   - Windows Terminal con win32-input-mode: ESC[Vk;Sc;Uc;Kd;Cs;Rc_
//   - Terminales con kitty/CSI u (fixterms):  ESC[<codepoint>[;<mods>]u
//   - Linux/macOS y Windows sin modos extendidos: el char llega raw
// Devuelve null si no logra decodificar.
function decodeTypedChar(str: string): string | null {
  WIN32_INPUT_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WIN32_INPUT_REGEX.exec(str)) !== null) {
    const uc = parseInt(match[3], 10);
    const kd = parseInt(match[4], 10);
    if (kd === 1 && uc > 0 && uc < 0x110000) {
      return String.fromCodePoint(uc);
    }
  }

  const csiU = str.match(CSI_U_REGEX);
  if (csiU) {
    const cp = parseInt(csiU[1], 10);
    if (cp > 0 && cp < 0x110000) {
      return String.fromCodePoint(cp);
    }
  }

  if (str.length === 1) {
    return str;
  }

  return null;
}

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

      // Aseguramos que el terminal local NO entre en win32-input-mode
      // (si lo hace, cada tecla llega encoded como ESC[Vk;Sc;Uc;Kd;Cs;Rc_
      // y se producen loops de eco feos en teardown).
      process.stdout.write("\x1b[?9001l");

      // PTY output → usuario + agente
      this.ptyProcess.onData((data: string) => {
        // Removemos intentos del lado remoto de encender win32-input-mode
        // o kitty-keyboard-protocol, que rompen el approval flow.
        const cleaned = data
          .replace(/\x1b\[\?9001h/g, "")
          .replace(/\x1b\[>\d+u/g, "");
        process.stdout.write(cleaned);
        try {
          this.options.agent.sendOutput(cleaned);
        } catch {
          // No romper el terminal si el agente falla
        }
      });

      // Usuario input → PTY
      const onStdinData = (data: Buffer) => {
        if (!this.ptyProcess) return;
        const str = data.toString();

        const decodedKey = decodeTypedChar(str);
        const effectiveKey = decodedKey ?? str;

        if (effectiveKey === "\x0F" && this.options.modeManager) {
          this.options.modeManager.cycleMode();
          return;
        }

        if (this.options.modeManager?.hasPendingApproval()) {
          if (this.options.modeManager.handleApprovalInput(effectiveKey)) {
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
