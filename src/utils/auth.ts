import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = join(homedir(), ".ssh-copilot");
const TOKEN_FILE = join(CONFIG_DIR, "token");

export function getTokenPath(): string {
  return TOKEN_FILE;
}

export function ensureToken(): string {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    try {
      chmodSync(CONFIG_DIR, 0o700);
    } catch {
      // Windows: chmod is a no-op; ACLs protect the user dir anyway.
    }
  }

  if (existsSync(TOKEN_FILE)) {
    const existing = readFileSync(TOKEN_FILE, "utf8").trim();
    if (existing.length >= 32) return existing;
  }

  const token = randomBytes(32).toString("hex");
  writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
  try {
    chmodSync(TOKEN_FILE, 0o600);
  } catch {
    // Windows fallback.
  }
  return token;
}

export function readToken(): string {
  if (!existsSync(TOKEN_FILE)) {
    throw new Error(
      `Auth token not found at ${TOKEN_FILE}. Start the server first with \`ssh-copilot server\`.`
    );
  }
  const token = readFileSync(TOKEN_FILE, "utf8").trim();
  if (!token) {
    throw new Error(`Auth token file is empty: ${TOKEN_FILE}`);
  }
  return token;
}
