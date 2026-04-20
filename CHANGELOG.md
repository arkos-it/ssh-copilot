# Changelog

All notable changes to this project are documented here. Format is loosely
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the
project follows [Semantic Versioning](https://semver.org).

## [Unreleased]

### Added
- `search_terminal` MCP tool: regex search across the session output buffer
  with optional context lines, configurable flags and match cap
- `read_terminal` now supports `lines`, `offset`, `since_id` and
  `last_commands` params; response includes `oldest_available_id`,
  `latest_id`, `total_lines_in_buffer`, and `filtered_by_command`
- Monotonic line ids in the server-side context buffer
- Agent-issued commands are now tracked, so `last_commands` works for them
- `pending_approval` as a first-class status for `run_command` in SUGGEST
  mode — the agent is no longer blocked while waiting for a human
- Auto-generated local auth token at `~/.ssh-copilot/token` (0600)
  protecting the WebSocket channel
- CI matrix on Ubuntu, macOS and Windows for Node 18 and 20
- Minimal unit tests for the context buffer

### Changed
- Default MCP HTTP port 3100 → 3124 to reduce conflicts with common dev apps
- WebSocket server is bound to `127.0.0.1` explicitly
- Client connects to `127.0.0.1` explicitly to avoid IPv6 localhost pitfalls
- Context buffer grows to 1000 lines (was 100) and caps partial lines at 4KB
- Package renamed to `ssh-copilot` (from `arkos-ssh`); CLI command matches
- Log prefix changed from `[arkos]` to `[ssh-copilot]`

### Fixed
- Approval prompt (`y`/`n`) on Windows Terminal: keys arrived as
  `win32-input-mode` sequences and were never intercepted. The PTY output
  is now cleaned of `ESC[?9001h` and `ESC[>Nu`, and stdin is decoded through
  a cross-protocol key parser (win32-input-mode, CSI u, raw)
- Cleanup on session exit: explicitly disables extended keyboard protocols
  so terminals are not left in a weird state
- Approval prompt is lenient with `y\r`/`yes\r\n` style line-buffered input

## [0.1.0] — initial release

Initial public scaffold on GitHub. Not yet on npm.
