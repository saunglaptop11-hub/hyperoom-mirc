import { describe, expect, it, vi } from "vitest";
import { createHyperoomCommandEngine } from "./hyperoom-command-engine";
import type { HyperoomProfile, HyperoomRoom } from "@hyperoom/shared";

const profile: HyperoomProfile = { id: "u1", systemRole: "member", username: "calculus_1987", displayName: "Calculus", avatarUrl: null, bio: null, statusText: null, lastSeenAt: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
const room: HyperoomRoom = { id: "r1", name: "general", type: "public", description: null, topic: "Welcome", isLocked: false, createdBy: "u1", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
function deps() {
  return {
    repository: {
      getProfile: vi.fn().mockResolvedValue(profile), upsertProfile: vi.fn(), updateUsername: vi.fn().mockResolvedValue({ ...profile, username: "newnick", updatedAt: "2026-01-02" }),
      listPublicRooms: vi.fn(), createRoom: vi.fn().mockResolvedValue(room), getRoomByName: vi.fn().mockResolvedValue(room), updateRoom: vi.fn().mockResolvedValue({ ...room, isLocked: true }), updateRoomTopic: vi.fn().mockResolvedValue({ ...room, topic: "New topic" }),
      joinRoom: vi.fn().mockResolvedValue({ roomId: "r1", userId: "u1", role: "member", joinedAt: "2026-01-01" }), leaveRoom: vi.fn().mockResolvedValue(undefined), listMembers: vi.fn(), listMemberProfiles: vi.fn().mockResolvedValue([{ roomId: "r1", userId: "u1", role: "member", joinedAt: "2026-01-01", profile }]), listMessages: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue({ id: "m1" }), editMessage: vi.fn(), deleteMessage: vi.fn(), addReaction: vi.fn(), removeReaction: vi.fn(), subscribeRoom: vi.fn(), subscribePublicRooms: vi.fn(),
    },
    auth: { getSession: vi.fn(), signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn().mockResolvedValue(undefined), onAuthStateChange: vi.fn() },
    getProfile: () => profile,
  } as any;
}

describe("Hyperoom command handlers", () => {
  it("supports help and reports the registry", async () => { const d = deps(); const engine = createHyperoomCommandEngine(d); const result = await engine.execute("/help", { currentRoom: room, nickname: profile.username }); expect(result.kind).toBe("SYSTEM_EVENT"); expect(result.content).toContain("/join #channel"); expect(result.content).toContain("/lock"); });
  it("joins a real resolved room", async () => { const d = deps(); const engine = createHyperoomCommandEngine(d); const result = await engine.execute("/join #general", { currentRoom: null, nickname: profile.username }); expect(d.repository.getRoomByName).toHaveBeenCalledWith("general"); expect(d.repository.joinRoom).toHaveBeenCalledWith("r1"); expect(result.room).toEqual(room); });
  it("handles missing and unknown commands", async () => { const d = deps(); const engine = createHyperoomCommandEngine(d); expect((await engine.execute("/join", { currentRoom: room, nickname: profile.username })).content).toContain("Usage"); expect((await engine.execute("/wat", { currentRoom: room, nickname: profile.username })).content).toBe("Unknown command: /wat"); });
  it("executes room management and existing commands through the repository", async () => { const d = deps(); const engine = createHyperoomCommandEngine(d); const context = { currentRoom: room, nickname: profile.username }; expect((await engine.execute("/part", context)).kind).toBe("SUCCESS"); expect(d.repository.leaveRoom).toHaveBeenCalledWith("r1"); expect((await engine.execute("/me is testing", context)).kind).toBe("SUCCESS"); expect((await engine.execute("/topic New topic", context)).room?.topic).toBe("New topic"); expect((await engine.execute("/lock", context)).kind).toBe("SUCCESS"); expect(d.repository.updateRoom).toHaveBeenCalledWith("r1", { isLocked: true }); expect((await engine.execute("/nick newnick", context)).kind).toBe("SUCCESS"); expect((await engine.execute("/who", context)).content).toContain("@calculus_1987"); expect((await engine.execute("/clear", context)).data).toEqual({ action: "clear-room", roomId: "r1" }); });
  it("supports creating a room", async () => { const d = deps(); const engine = createHyperoomCommandEngine(d); const result = await engine.execute("/create #new-room", { currentRoom: null, nickname: profile.username }); expect(d.repository.createRoom).toHaveBeenCalledWith(expect.objectContaining({ name: "new-room", type: "public", isLocked: false })); expect(result.room).toEqual(room); });
  it("quit signs out after emitting a real quit event", async () => { const d = deps(); const engine = createHyperoomCommandEngine(d); const result = await engine.execute("/quit", { currentRoom: room, nickname: profile.username }); expect(d.repository.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: "system", eventType: "quit" })); expect(d.auth.signOut).toHaveBeenCalled(); expect(result.kind).toBe("SUCCESS"); });
});
