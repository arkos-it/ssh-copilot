import type { IAgent } from "./types.js";
import type { AgentContext } from "../context-buffer.js";
import type { ContextBuffer } from "../context-buffer.js";
import type { WsClient } from "../client/ws-client.js";
import type { Logger } from "../utils/logger.js";

export class RemoteAgent implements IAgent {
  private buffer: ContextBuffer;
  private wsClient: WsClient;
  private logger?: Logger;

  constructor(buffer: ContextBuffer, wsClient: WsClient, logger?: Logger) {
    this.buffer = buffer;
    this.wsClient = wsClient;
    this.logger = logger;
  }

  sendOutput(output: string): void {
    this.buffer.appendOutput(output);
    this.wsClient.sendOutput(output);
    this.logger?.debug("Remote agent sent output", output.length, "chars");
  }

  addCommand(command: string): void {
    this.buffer.addCommand(command);
    this.wsClient.sendCommand(command);
    this.logger?.debug("Remote agent sent command:", command);
  }

  getContext(): AgentContext {
    return this.buffer.getSnapshot();
  }
}
