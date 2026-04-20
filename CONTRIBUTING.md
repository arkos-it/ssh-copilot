# Contributing to SSH Copilot

Thanks for wanting to help. This is an early project — code is small, rough
edges are welcome to be smoothed.

## Development setup

```bash
git clone https://github.com/arkos-it/ssh-copilot.git
cd ssh-copilot
npm install
npm run dev -- connect user@host   # run the CLI from source
```

Useful scripts:

- `npm run typecheck` — TypeScript strict check, no emit
- `npm test` — unit tests via `node --test` + `tsx`
- `npm run build` — bundle to `dist/` with tsup

CI runs `typecheck`, `test`, and `build` on Node 18/20 across Ubuntu, macOS
and Windows. A PR that passes CI is a good start.

## What to work on

Fair game:

- Bug fixes (please attach steps to reproduce)
- Cross-platform issues — Windows Terminal, WezTerm, kitty, tmux, etc.
- Test coverage for `context-buffer`, `mode-manager`, `ssh-session`
- Docs clarifications

Please open an issue first for:

- New MCP tools
- Changes to the approval/modes UX
- Protocol changes between client and server

## Security

Never commit SSH keys, tokens, or `.env` files. The auth token at
`~/.ssh-copilot/token` is host-local and not meant to leave your machine.
If you find a security issue, please open an issue — we'll coordinate
a fix before any detailed public discussion.

## Commit style

- Imperative mood, lowercase, short subject: `fix: approval y/n on Windows`
- Body explains *why*, not what
- Reference issues in the body if applicable

## Code conventions

- TypeScript strict mode, no `any` unless justified in a comment
- No new dependencies without a clear reason
- No emojis in code or tests
- Minimal comments — names should do the work; comment only when the *why*
  is non-obvious
