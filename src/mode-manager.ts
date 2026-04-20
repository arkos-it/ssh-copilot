export enum AgentMode {
  YOLO = "yolo",
  SUGGEST = "suggest",
  READONLY = "readonly",
}

const MODE_LABELS: Record<AgentMode, string> = {
  [AgentMode.YOLO]: "\x1b[32m[YOLO]\x1b[0m",
  [AgentMode.SUGGEST]: "\x1b[33m[SUGGEST]\x1b[0m",
  [AgentMode.READONLY]: "\x1b[31m[READONLY]\x1b[0m",
};

const MODE_ORDER: AgentMode[] = [
  AgentMode.SUGGEST,
  AgentMode.READONLY,
  AgentMode.YOLO,
];

interface PendingApproval {
  command: string;
  resolve: (approved: boolean) => void;
}

export class ModeManager {
  currentMode: AgentMode = AgentMode.SUGGEST;
  private pending: PendingApproval | null = null;
  private destination: string;

  constructor(destination: string, defaultMode?: AgentMode) {
    this.destination = destination;
    if (defaultMode) {
      this.currentMode = defaultMode;
    }
  }

  cycleMode(): AgentMode {
    // Rechazar comando pendiente al cambiar de modo
    if (this.pending) {
      this.pending.resolve(false);
      this.clearPrompt();
      this.pending = null;
    }

    const idx = MODE_ORDER.indexOf(this.currentMode);
    this.currentMode = MODE_ORDER[(idx + 1) % MODE_ORDER.length];
    this.updateTitle();
    this.showModeNotification();
    return this.currentMode;
  }

  requestApproval(command: string): Promise<boolean> {
    // Si ya hay uno pendiente, rechazar el anterior
    if (this.pending) {
      this.pending.resolve(false);
      this.clearPrompt();
    }

    return new Promise((resolve) => {
      this.pending = { command, resolve };
      this.showApprovalPrompt(command);
    });
  }

  handleApprovalInput(key: string): boolean {
    if (!this.pending) return false;

    if (key === "y" || key === "Y") {
      this.clearPrompt();
      this.pending.resolve(true);
      this.pending = null;
      return true;
    }

    if (key === "n" || key === "N") {
      this.clearPrompt();
      this.pending.resolve(false);
      this.pending = null;
      return true;
    }

    return false;
  }

  hasPendingApproval(): boolean {
    return this.pending !== null;
  }

  updateTitle(): void {
    const modeTag = this.currentMode.toUpperCase();
    process.stdout.write(`\x1b]0;[${modeTag}] ${this.destination}\x07`);
  }

  private showModeNotification(): void {
    const label = MODE_LABELS[this.currentMode];
    process.stdout.write(`\r\n${label} Mode changed\r\n`);
  }

  private showApprovalPrompt(command: string): void {
    process.stdout.write(
      `\r\n\x1b[33m[AGENT]\x1b[0m ${command} \x1b[2m— (y)es / (n)o?\x1b[0m `
    );
  }

  private clearPrompt(): void {
    process.stdout.write(`\r\x1b[2K`);
  }
}
