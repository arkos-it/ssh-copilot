# Arkos SSH Copilot

Run SSH with an AI copilot that sees everything you do.

Your terminal stays the same — but now your AI can watch, understand, and execute commands alongside you in real time.

---

## ⚡ Why this is different

Arkos SSH Copilot is designed to work *with* AI coding agents — not replace them.

Compatible with tools like:

* Claude Code
* GitHub Copilot (CLI / Agents)
* Cursor
* Codeium
* OpenAI Codex-style agents

Unlike GUI-based tools, Arkos SSH Copilot:

* Uses your existing terminal (no new UI)
* Works directly with real SSH sessions
* Shares a live terminal between you and your AI
* Supports interactive programs like `vim`, `nano`, `top`

This is not a terminal replacement.

This is a **shared terminal layer for humans and AI agents**.

---

## 🚀 Quick Start

```bash
npm install -g arkos-ssh
```

### 1. Start the server

```bash
arkos-ssh server
```

### 2. Connect to your server

```bash
arkos-ssh connect user@host

# With private key
arkos-ssh connect -i ~/.ssh/key.pem user@host

# Custom port
arkos-ssh connect -p 2222 user@host
```

Your SSH session works exactly as before: colors, vim, nano, top, resize — everything.

---

### 3. Connect your AI agent

Add this to your `.mcp.json`:

```json
{
  "mcpServers": {
    "arkos-ssh": {
      "type": "http",
      "url": "http://localhost:3100/mcp"
    }
  }
}
```

Done. Your AI can now **see and act inside your SSH sessions** — exactly as you do.

---

## 🧠 What makes this powerful

Most AI tools only see the commands they execute.

Arkos SSH Copilot sees **everything**:

* Commands you type
* Output from the terminal
* Interactive sessions

This means the AI never loses context.

---

## 🛠 Agent Capabilities

| Tool            | Description                       |
| --------------- | --------------------------------- |
| `list_sessions` | List all active SSH sessions      |
| `read_terminal` | Read recent terminal output       |
| `run_command`   | Execute commands inside a session |

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
arkos-ssh connect -i key.pem ubuntu@server-1

# Terminal 2
arkos-ssh connect -i key.pem ubuntu@server-2
```

The agent can see and operate across both sessions.

---

## ⚙️ Commands

### `arkos-ssh server`

Starts the bridge between your SSH sessions and AI agents.

```
--port <port>      MCP HTTP server port (default: 3100)
--ws-port <port>   WebSocket port (default: 3101)
--debug            Enable debug mode
```

---

### `arkos-ssh connect`

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
Your Terminal                    Your AI Agent
┌─────────────────────┐         ┌─────────────────────┐
│ arkos-ssh connect    │         │ Claude Code         │
│ ubuntu@my-server     │         │                     │
│                      │         │ "check logs"        │
│ $ docker ps          │◄──────► │ run_command(...)    │
│ CONTAINER ID IMAGE   │  shared │ read_terminal()     │
│ abc123 nginx:latest  │ terminal│ "nginx is down"     │
│ $                    │ context │                     │
└──────────┬───────────┘         └──────────┬──────────┘
           │                                │
           └──────────► Server ◄────────────┘
                    (MCP + WebSocket)
```

1. `arkos-ssh server` runs locally
2. `arkos-ssh connect` opens real SSH sessions using a PTY
3. The AI agent connects via MCP and can read/write to sessions

---

## 📦 Requirements

* Node.js >= 18
* OpenSSH installed (default on macOS, Linux, Windows 10+)

---

## 📜 License

MIT
