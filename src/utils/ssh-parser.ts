import { resolve } from "node:path";

export interface SshTarget {
  user?: string;
  host: string;
  port?: number;
}

export interface CliOptions {
  debug?: boolean;
  agentDebug?: boolean;
  port?: string;
  identity?: string;
}

export function parseSshTarget(target: string): SshTarget {
  const atIndex = target.indexOf("@");

  if (atIndex === -1) {
    return { host: target };
  }

  return {
    user: target.substring(0, atIndex),
    host: target.substring(atIndex + 1),
  };
}

export function buildSshArgs(
  target: SshTarget,
  options: CliOptions,
  extraArgs: string[] = []
): string[] {
  const args: string[] = [];

  if (options.port) {
    args.push("-p", options.port);
  }

  if (options.identity) {
    args.push("-i", resolve(options.identity));
  }

  // Keep-alive para evitar timeout por inactividad
  args.push("-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=3");

  args.push(...extraArgs);

  const destination = target.user
    ? `${target.user}@${target.host}`
    : target.host;

  args.push(destination);

  return args;
}
