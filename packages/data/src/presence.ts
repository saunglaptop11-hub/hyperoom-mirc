import type { RealtimeChannel } from "@supabase/supabase-js";
import type { HyperoomPresence } from "@hyperoom/shared";
import type { HyperoomSupabaseClient } from "./client";

export interface PresenceApi {
  joinRoomPresence(roomId: string, userId: string, displayName: string, onChange: (presence: HyperoomPresence[]) => void): RealtimeChannel;
  setTyping(channel: RealtimeChannel, roomId: string, userId: string, typing: boolean): Promise<void>;
}

export function createPresenceApi(client: HyperoomSupabaseClient): PresenceApi {
  return {
    joinRoomPresence(roomId, userId, displayName, onChange) {
      const channel = client.channel(`presence:${roomId}`, { config: { presence: { key: userId } } });
      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ userId: string; displayName: string; onlineAt: string }>();
        const entries: HyperoomPresence[] = Object.entries(state).map(([key, values]) => {
          const latest = values.at(-1);
          return { userId: latest?.userId ?? key, status: "online", lastSeenAt: latest?.onlineAt ?? null };
        });
        onChange(entries);
      });
      void channel.subscribe(status => {
        if (status === "SUBSCRIBED") {
          void channel.track({ userId, displayName, onlineAt: new Date().toISOString() });
        }
      });
      return channel;
    },
    async setTyping(channel, roomId, userId, typing) {
      await channel.send({ type: "broadcast", event: "typing", payload: { roomId, userId, typing, at: Date.now() } });
    },
  };
}
