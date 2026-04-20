import type { IAgent } from "./types.js";
import type { AgentContext } from "../context-buffer.js";
import { ContextBuffer } from "../context-buffer.js";
import type { Logger } from "../utils/logger.js";

export class AgentStub implements IAgent {
  private buffer: ContextBuffer;
  private logger?: Logger;

  constructor(buffer: ContextBuffer, logger?: Logger) {
    this.buffer = buffer;
    this.logger = logger;
  }

  sendOutput(output: string): void {
    this.buffer.appendOutput(output);
    this.logger?.debug("Agent received output", output.length, "chars");
  }

  addCommand(command: string): void {
    this.buffer.addCommand(command);
    this.logger?.debug("Command detected:", command);
  }

  getContext(): AgentContext {
    return this.buffer.getSnapshot();
  }
}
