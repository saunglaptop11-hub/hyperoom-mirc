import { describe, expect, it } from "vitest";
import { parseHyperoomCommand } from "./parser";

describe("Hyperoom command parser", () => {
  it("parses room and message commands", () => {
    expect(parseHyperoomCommand("/join #ngobrol")).toEqual({
      ok: true,
      command: { type: "join", room: "#ngobrol" },
    });
    expect(parseHyperoomCommand("/msg Budi halo bro")).toEqual({
      ok: true,
      command: { type: "msg", target: "Budi", text: "halo bro" },
    });
  });

  it("parses action, identity and moderation commands", () => {
    expect(parseHyperoomCommand("/me waves")).toEqual({
      ok: true,
      command: { type: "me", text: "waves" },
    });
    expect(parseHyperoomCommand("/nick Asep")).toEqual({
      ok: true,
      command: { type: "nick", nickname: "Asep" },
    });
    expect(parseHyperoomCommand("/kick #ngobrol Budi spam")).toEqual({
      ok: true,
      command: { type: "kick", room: "#ngobrol", target: "Budi", reason: "spam" },
    });
  });

  it("rejects incomplete and unknown commands", () => {
    expect(parseHyperoomCommand("/msg Budi").ok).toBe(false);
    expect(parseHyperoomCommand("/mode #ngobrol").ok).toBe(false);
    expect(parseHyperoomCommand("/doesnotexist").ok).toBe(false);
  });
});
