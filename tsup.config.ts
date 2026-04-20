import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node18",
  clean: true,
  sourcemap: true,
  external: ["node-pty", "express", "ws", "@modelcontextprotocol/sdk", "zod"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
