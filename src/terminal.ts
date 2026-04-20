export class TerminalManager {
  private wasRaw = false;
  private resizeCallback?: (cols: number, rows: number) => void;
  private resizeHandler = () => {
    if (this.resizeCallback) {
      this.resizeCallback(
        process.stdout.columns,
        process.stdout.rows
      );
    }
  };

  setup(): void {
    if (process.stdin.isTTY) {
      this.wasRaw = process.stdin.isRaw;
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdout.on("resize", this.resizeHandler);
  }

  restore(): void {
    process.stdout.removeListener("resize", this.resizeHandler);
    // Desarmamos protocolos de teclado extendidos por si el remoto los dejó
    // encendidos: win32-input-mode y kitty-keyboard-protocol.
    process.stdout.write("\x1b[?9001l\x1b[<u");
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(this.wasRaw);
    }
    process.stdin.pause();
  }

  onResize(callback: (cols: number, rows: number) => void): void {
    this.resizeCallback = callback;
  }

  get cols(): number {
    return process.stdout.columns || 80;
  }

  get rows(): number {
    return process.stdout.rows || 24;
  }

  setTitle(text: string): void {
    process.stdout.write(`\x1b]0;${text}\x07`);
  }
}
