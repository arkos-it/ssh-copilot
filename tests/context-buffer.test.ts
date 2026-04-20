import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { ContextBuffer } from "../src/context-buffer.js";

describe("ContextBuffer.appendOutput", () => {
  it("splits output by newline and assigns monotonic ids", () => {
    const buf = new ContextBuffer();
    buf.appendOutput("alpha\nbeta\ngamma\n");
    const { lines } = buf.read();
    assert.deepEqual(
      lines.map((l) => l.text),
      ["alpha", "beta", "gamma"]
    );
    assert.deepEqual(
      lines.map((l) => l.id),
      [0, 1, 2]
    );
  });

  it("buffers partial lines until newline arrives", () => {
    const buf = new ContextBuffer();
    buf.appendOutput("hello ");
    buf.appendOutput("world\n");
    const { lines } = buf.read();
    assert.equal(lines.length, 1);
    assert.equal(lines[0].text, "hello world");
  });

  it("strips ANSI escape sequences", () => {
    const buf = new ContextBuffer();
    buf.appendOutput("\x1b[31mERROR\x1b[0m\n");
    const { lines } = buf.read();
    assert.equal(lines[0].text, "ERROR");
  });

  it("caps the in-flight partial line at 4KB", () => {
    const buf = new ContextBuffer();
    buf.appendOutput("x".repeat(10_000));
    buf.appendOutput("\n");
    const { lines } = buf.read();
    assert.equal(lines.length, 1);
    assert.equal(lines[0].text.length, 4096);
  });

  it("rotates when max lines exceeded", () => {
    const buf = new ContextBuffer(3);
    for (let i = 0; i < 5; i++) buf.appendOutput(`line${i}\n`);
    const { lines, oldest_available_id, latest_id } = buf.read();
    assert.deepEqual(lines.map((l) => l.text), ["line2", "line3", "line4"]);
    assert.equal(oldest_available_id, 2);
    assert.equal(latest_id, 4);
  });
});

describe("ContextBuffer.read options", () => {
  it("respects lines", () => {
    const buf = new ContextBuffer();
    for (let i = 0; i < 10; i++) buf.appendOutput(`l${i}\n`);
    const { lines } = buf.read({ lines: 3 });
    assert.deepEqual(lines.map((l) => l.text), ["l7", "l8", "l9"]);
  });

  it("respects offset from the end", () => {
    const buf = new ContextBuffer();
    for (let i = 0; i < 10; i++) buf.appendOutput(`l${i}\n`);
    const { lines } = buf.read({ lines: 3, offset: 2 });
    assert.deepEqual(lines.map((l) => l.text), ["l5", "l6", "l7"]);
  });

  it("filters by since_id", () => {
    const buf = new ContextBuffer();
    for (let i = 0; i < 5; i++) buf.appendOutput(`l${i}\n`);
    const { lines } = buf.read({ since_id: 2 });
    assert.deepEqual(lines.map((l) => l.id), [3, 4]);
  });

  it("filters to last_commands", () => {
    const buf = new ContextBuffer();
    buf.appendOutput("pre\n");
    buf.addCommand("ls");
    buf.appendOutput("file1\nfile2\n");
    buf.addCommand("pwd");
    buf.appendOutput("/home\n");
    const result = buf.read({ last_commands: 1 });
    assert.deepEqual(result.lines.map((l) => l.text), ["/home"]);
    assert.equal(result.filtered_by_command?.command, "pwd");
  });
});

describe("ContextBuffer.search", () => {
  it("finds all matches and respects max_matches", () => {
    const buf = new ContextBuffer();
    buf.appendOutput("ok\nERROR: boom\nok\nERROR: bang\nok\nERROR: thud\n");
    const { matches, truncated } = buf.search({
      pattern: "ERROR",
      max_matches: 2,
    });
    assert.equal(matches.length, 2);
    assert.ok(truncated);
  });

  it("returns context lines", () => {
    const buf = new ContextBuffer();
    buf.appendOutput("a\nb\nERROR\nc\nd\n");
    const { matches } = buf.search({ pattern: "ERROR", context_lines: 1 });
    assert.equal(matches.length, 1);
    assert.deepEqual(matches[0].before, ["b"]);
    assert.deepEqual(matches[0].after, ["c"]);
  });

  it("rejects an invalid regex", () => {
    const buf = new ContextBuffer();
    assert.throws(() => buf.search({ pattern: "(unbalanced" }));
  });

  it("rejects a too-long pattern", () => {
    const buf = new ContextBuffer();
    assert.throws(() => buf.search({ pattern: "x".repeat(300) }));
  });
});
