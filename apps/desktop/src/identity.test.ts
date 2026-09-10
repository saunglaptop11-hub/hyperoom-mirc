import { describe, expect, it } from "vitest";
import { identityColor, platformMarker, roomMarker } from "./identity";

describe("identity presentation", () => {
  it("assigns deterministic identity colors", () => {
    expect(identityColor("user-a")).toBe(identityColor("user-a"));
    expect(identityColor("user-a")).toMatch(/^#/);
  });

  it("uses explicit platform and room role markers", () => {
    expect(platformMarker("owner")).toBe("👑");
    expect(platformMarker("admin")).toBe("🛡️");
    expect(roomMarker("owner")).toBe("🏠");
    expect(roomMarker("operator")).toBe("@");
    expect(roomMarker("voice")).toBe("+");
    expect(roomMarker("member")).toBe("");
  });
});
