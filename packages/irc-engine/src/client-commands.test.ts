import { describe, expect, it, vi } from "vitest";
import { createClientCommandRegistry, ClientCommandEngine, parseClientCommand } from "./client-commands.js";

describe("client command parser", () => {
  it("keeps normal messages as normal messages", () => {
    expect(parseClientCommand("  hello   bro  ")).toEqual({ type: "normal", content: "hello   bro" });
  });
  it("parses command name case-insensitively and normalizes whitespace", () => {
    expect(parseClientCommand(" /JOIN   #general  ")).toEqual({ type: "command", name: "join", args: ["#general"], raw: "/JOIN   #general" });
  });
  it("supports commands with multiple arguments", () => {
    expect(parseClientCommand("/topic   welcome to Hyperoom")).toEqual({ type: "command", name: "topic", args: ["welcome", "to", "Hyperoom"], raw: "/topic   welcome to Hyperoom" });
  });
});

describe("client command engine", () => {
  it("returns a clear unknown-command error", async () => {
    const engine = new ClientCommandEngine(createClientCommandRegistry());
    await expect(engine.execute("/foobar", { currentRoom: null, nickname: "test" })).resolves.toEqual({ kind: "ERROR", content: "Unknown command: /foobar" });
  });
  it("returns a missing-command error", async () => {
    const engine = new ClientCommandEngine(createClientCommandRegistry());
    await expect(engine.execute("/", { currentRoom: null, nickname: "test" })).resolves.toEqual({ kind: "ERROR", content: "Command cannot be empty." });
  });
  it("does not manipulate UI and delegates to registered handlers", async () => {
    const handler = vi.fn().mockResolvedValue({ kind: "SUCCESS", content: "ok" });
    const registry = createClientCommandRegistry();
    registry.register({ name: "ping", usage: "/ping", description: "test", handler });
    const engine = new ClientCommandEngine(registry);
    await expect(engine.execute("/PING", { currentRoom: null, nickname: "test" })).resolves.toEqual({ kind: "SUCCESS", content: "ok" });
    expect(handler).toHaveBeenCalledWith([], { currentRoom: null, nickname: "test" });
  });
});
