import { describe, expect, it } from "vitest";
import { countUniquePresenceUsers } from "./presence";

describe("Realtime presence counters", () => {
  it("counts unique presence keys, not presence payloads", () => {
    expect(countUniquePresenceUsers({ u1: [{ tab: 1 }, { tab: 2 }], u2: [{ tab: 1 }] })).toBe(2);
  });

  it("returns zero for an empty presence state", () => {
    expect(countUniquePresenceUsers({})).toBe(0);
  });
});
