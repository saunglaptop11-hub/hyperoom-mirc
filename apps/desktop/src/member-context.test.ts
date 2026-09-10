import { describe, expect, it } from "vitest";
import type { HyperoomProfile, HyperoomRoomMemberProfile } from "@hyperoom/shared";
import { canModerateTarget } from "./member-context";

const profile = (id: string, username: string, systemRole: HyperoomProfile["systemRole"] = "member"): HyperoomProfile => ({ id, systemRole, username, displayName: username, avatarUrl: null, bio: null, statusText: null, lastSeenAt: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" });
const target = (id: string, username: string, role: HyperoomRoomMemberProfile["role"], systemRole: HyperoomProfile["systemRole"] = "member"): HyperoomRoomMemberProfile => ({ roomId: "r1", userId: id, role, joinedAt: "2026-01-01", profile: profile(id, username, systemRole) });

describe("room authority context rules", () => {
  it("allows owner to moderate member/operator but not platform owner", () => {
    const actor = profile("u1", "owner");
    expect(canModerateTarget(actor, "owner", target("u2", "member", "member"))).toBe(true);
    expect(canModerateTarget(actor, "owner", target("u3", "operator", "operator"))).toBe(true);
    expect(canModerateTarget(actor, "owner", target("u4", "platform", "member", "owner"))).toBe(false);
  });
  it("allows operator to moderate lower room roles only", () => {
    const actor = profile("u1", "op");
    expect(canModerateTarget(actor, "operator", target("u2", "member", "member"))).toBe(true);
    expect(canModerateTarget(actor, "operator", target("u3", "voice", "voice"))).toBe(true);
    expect(canModerateTarget(actor, "operator", target("u4", "owner", "owner"))).toBe(false);
    expect(canModerateTarget(actor, "operator", target("u5", "other-op", "operator"))).toBe(false);
  });
  it("allows platform owner global authority without treating it as a room role", () => {
    const actor = profile("u1", "calculus_1987", "owner");
    expect(canModerateTarget(actor, null, target("u2", "member", "member"))).toBe(true);
    expect(canModerateTarget(actor, null, target("u3", "platform-admin", "member", "admin"))).toBe(true);
    expect(canModerateTarget(actor, null, target("u4", "platform-owner", "member", "owner"))).toBe(false);
  });
  it("denies ordinary members", () => {
    const actor = profile("u1", "member");
    expect(canModerateTarget(actor, "member", target("u2", "other", "member"))).toBe(false);
  });
});
