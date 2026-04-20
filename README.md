# SSH Copilot

Run SSH with an AI copilot that sees everything you do.

Your terminal stays the same — but now your AI can watch, understand, and execute commands alongside you in real time.

---

## ⚡ Why this is different

SSH Copilot is designed to work *with* AI coding agents — not replace them.

Compatible with tools like:

* Claude Code
* GitHub Copilot (CLI / Agents)
* Cursor
* Codeium
* OpenAI Codex-style agents

Unlike GUI-based tools, SSH Copilot:

* Uses your existing terminal (no new UI)
* Works directly with real SSH sessions
* Shares a live terminal between you and your AI
* Supports interactive programs like `vim`, `nano`, `top`

This is not a terminal replacement.

This is a **shared terminal layer for humans and AI agents**.

---

## 🚀 Quick Start

```bash
npm install -g ssh-copilot
```

### 1. Start the server

```bash
ssh-copilot server
```

### 2. Connect to your server

```bash
ssh-copilot connect user@host

# With private key
ssh-copilot connect -i ~/.ssh/key.pem user@host

# Custom port
ssh-copilot connect -p 2222 user@host
```

Your SSH session works exactly as before: colors, vim, nano, top, resize — everything.

---

### 3. Connect your AI agent

#### Claude Code

Register it once, globally, and it will be available in every project:

```bash
claude mcp add --scope user --transport http ssh-copilot http://localhost:3124/mcp
```

Or, for a single project only, add this to the project's `.mcp.json`:

```json
{
  "mcpServers": {
    "ssh-copilot": {
      "type": "http",
      "url": "http://localhost:3124/mcp"
    }
  }
}
```

#### Other MCP-capable agents

Point your agent at `http://localhost:3124/mcp` over HTTP/SSE transport.

Done. Your AI can now **see and act inside your SSH sessions** — exactly as you do.

---

## 🧠 What makes this powerful

Most AI tools only see the commands they execute.

SSH Copilot sees **everything**:

* Commands you type
* Output from the terminal
* Interactive sessions

This means the AI never loses context.

---

## 🛠 Agent Capabilities

| Tool              | Description                                                                     |
| ----------------- | ------------------------------------------------------------------------------- |
| `list_sessions`   | List all active SSH sessions                                                    |
| `read_terminal`   | Read buffered output with pagination (`lines`, `offset`), deltas (`since_id`) or filtered to the output of the last N commands (`last_commands`) |
| `search_terminal` | Regex search across the buffered output, with optional context lines            |
| `run_command`     | Execute commands inside a session (SUGGEST asks, READONLY blocks, YOLO runs)   |

---

## 💡 Example Use Cases

### Debug a server

You: "My app is down, check what's wrong"

Agent:

* Runs `docker ps`
* Inspects logs
* Identifies the issue
* Suggests or applies a fix

---

### Set up infrastructure

You: "Install nginx with SSL for my domain"

Agent executes required commands while you watch everything in real time.

---

### Multiple servers

```bash
# Terminal 1
ssh-copilot connect -i key.pem ubuntu@server-1

# Terminal 2
ssh-copilot connect -i key.pem ubuntu@server-2
```

The agent can see and operate across both sessions.

---

## ⚙️ Commands

### `ssh-copilot server`

Starts the bridge between your SSH sessions and AI agents.

```
--port <port>      MCP HTTP server port (default: 3124)
--ws-port <port>   WebSocket port (default: 3101)
--debug            Enable debug mode
```

---

### `ssh-copilot connect`

Opens an SSH session and registers it with the server.

```
-p, --port <port>        SSH port
-i, --identity <file>    Private key file (.pem, etc.)
--server-url <url>       WebSocket server (default: ws://localhost:3101)
--debug                  Enable debug mode
```

If the server is not running, `connect` still works — just without AI integration.

---

## 🔍 How it works

```
Your Terminal                      Your AI Agent
┌───────────────────────┐         ┌─────────────────────┐
│ ssh-copilot connect   │         │ Claude Code         │
│ ubuntu@my-server      │         │                     │
│                       │         │ "check logs"        │
│ $ docker ps           │◄──────► │ run_command(...)    │
│ CONTAINER ID IMAGE    │  shared │ read_terminal()     │
│ abc123 nginx:latest   │ terminal│ "nginx is down"     │
│ $                     │ context │                     │
└──────────┬────────────┘         └──────────┬──────────┘
           │                                 │
           └──────────► Server ◄─────────────┘
                     (MCP + WebSocket)
```

1. `ssh-copilot server` runs locally
2. `ssh-copilot connect` opens real SSH sessions using a PTY
3. The AI agent connects via MCP and can read/write to sessions

---

## 🔐 Security

SSH Copilot runs entirely on your machine. The server and the SSH clients
communicate over a local WebSocket with two layers of protection — no manual
setup needed:

* **Loopback-only binding** — the WebSocket server listens on `127.0.0.1`, so
  other hosts on your network cannot reach it.
* **Auto-generated local token** — on first `ssh-copilot server` run, a random
  token is stored at `~/.ssh-copilot/token` (permissions `0600`, readable only
  by your user). The `ssh-copilot connect` command reads it automatically.

This means other users on the same machine cannot hijack or observe your
sessions, and remote machines cannot connect at all.

The MCP HTTP endpoint (default `http://localhost:3124/mcp`) is also bound to
loopback. Configure your AI agent to point there.

## 📦 Requirements

* Node.js >= 18
* OpenSSH installed (default on macOS, Linux, Windows 10+)

---

## 📜 License

MIT
