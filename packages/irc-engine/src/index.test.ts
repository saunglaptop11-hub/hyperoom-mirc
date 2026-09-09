import { describe, expect, it } from "vitest";
import { createIrcEngine } from "./index";

describe("IRC engine foundation", () => {
  it("starts disconnected", () => {
    const engine = createIrcEngine();
    expect(engine.getState()).toEqual({ status: "disconnected" });
  });

  it("does not claim a network transport in Phase 1A", async () => {
    const engine = createIrcEngine();
    await expect(engine.connect({
      host: "irc.example.test", port: 6697, tls: true,
      nickname: "HyperoomUser", username: "hyperoom", realname: "Hyperoom mIRC",
    })).rejects.toThrow("not part of Phase 1A");
  });
});
