import type { RealtimeChannel } from "@supabase/supabase-js";
import type { HyperoomPresenceSnapshot } from "@hyperoom/shared";
import type { HyperoomSupabaseClient } from "./client";

export interface PresenceApi {
  subscribeGlobalPresence(userId: string, onChange: (count: number) => void, onStatus?: (status: string) => void): RealtimeChannel;
  subscribeRoomPresence(roomId: string, userId: string, onChange: (count: number) => void, onStatus?: (status: string) => void): RealtimeChannel;
  trackRoom(channel: RealtimeChannel, roomId: string, userId: string): Promise<void>;
  untrackRoom(channel: RealtimeChannel): Promise<void>;
  setTyping(channel: RealtimeChannel, roomId: string, userId: string, typing: boolean): Promise<void>;
}

export function countUniquePresenceUsers(state: Record<string, unknown[]>): number { return new Set(Object.keys(state)).size; }

export function createPresenceApi(client: HyperoomSupabaseClient): PresenceApi {
  const syncCount = (channel: RealtimeChannel, onChange: (count: number) => void) => onChange(countUniquePresenceUsers(channel.presenceState()));
  return {
    subscribeGlobalPresence(userId, onChange, onStatus) {
      const channel = client.channel("hyperoom:presence", { config: { private: true, presence: { key: userId } } });
      channel.on("presence", { event: "sync" }, () => syncCount(channel, onChange));
      void channel.subscribe(async (status) => { onStatus?.(status); if (status === "SUBSCRIBED") await channel.track({ userId, onlineAt: new Date().toISOString() }); });
      return channel;
    },
    subscribeRoomPresence(roomId, userId, onChange, onStatus) {
      const channel = client.channel(`hyperoom:room:${roomId}:presence`, { config: { private: true, presence: { key: userId } } });
      channel.on("presence", { event: "sync" }, () => syncCount(channel, onChange));
      void channel.subscribe((status) => onStatus?.(status)); return channel;
    },
    async trackRoom(channel, roomId, userId) { await channel.track({ roomId, userId, onlineAt: new Date().toISOString() }); },
    async untrackRoom(channel) { await channel.untrack(); },
    async setTyping(channel, roomId, userId, typing) { await channel.send({ type: "broadcast", event: "typing", payload: { roomId, userId, typing, at: Date.now() } }); },
  };
}

export function presenceSnapshot(globalCount: number, roomCounts: Record<string, number>): HyperoomPresenceSnapshot { return { globalCount, roomCounts }; }

