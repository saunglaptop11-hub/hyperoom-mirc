import { describe, expect, it, vi } from "vitest";
import { HyperoomChatEngine } from "./index.js";

describe("HyperoomChatEngine", () => {
  it("normalizes and sends real message input", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ id: "m1" });
    const engine = new HyperoomChatEngine({
      joinRoom: vi.fn(), leaveRoom: vi.fn(), sendMessage,
      editMessage: vi.fn(), deleteMessage: vi.fn(), addReaction: vi.fn(), removeReaction: vi.fn(),
    });
    await engine.sendMessage({ roomId: "r1", content: "  hello  " });
    expect(sendMessage).toHaveBeenCalledWith({ roomId: "r1", content: "hello" });
  });

  it("rejects empty and oversized messages before persistence", async () => {
    const sendMessage = vi.fn();
    const engine = new HyperoomChatEngine({
      joinRoom: vi.fn(), leaveRoom: vi.fn(), sendMessage,
      editMessage: vi.fn(), deleteMessage: vi.fn(), addReaction: vi.fn(), removeReaction: vi.fn(),
    });
    await expect(engine.sendMessage({ roomId: "r1", content: "   " })).rejects.toThrow("cannot be empty");
    await expect(engine.sendMessage({ roomId: "r1", content: "x".repeat(4001) })).rejects.toThrow("4000");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("normalizes reactions", async () => {
    const addReaction = vi.fn().mockResolvedValue({ messageId: "m1" });
    const engine = new HyperoomChatEngine({
      joinRoom: vi.fn(), leaveRoom: vi.fn(), sendMessage: vi.fn(),
      editMessage: vi.fn(), deleteMessage: vi.fn(), addReaction, removeReaction: vi.fn(),
    });
    await engine.addReaction("m1", "  ❤️ ");
    expect(addReaction).toHaveBeenCalledWith("m1", "❤️");
  });
});
