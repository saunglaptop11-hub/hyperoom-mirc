import {
  ClientCommandEngine,
  createClientCommandRegistry,
  type ClientCommandContext,
} from "@hyperoom/irc-engine";
import type { AuthApi, HyperoomRepository } from "@hyperoom/data";
import type { HyperoomProfile, HyperoomRoom } from "@hyperoom/shared";

const CHANNEL_NAME = /^#?[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;
const NICKNAME = /^[A-Za-z0-9_]{2,24}$/;

function requireRoom(context: ClientCommandContext): HyperoomRoom {
  if (!context.currentRoom) throw new Error("This command requires an active channel.");
  return context.currentRoom;
}

function channelName(value: string): string {
  if (!CHANNEL_NAME.test(value)) throw new Error("Invalid channel name. Use #channel with letters, numbers, _ or -.");
  return value.replace(/^#/, "");
}

export function createHyperoomCommandEngine(deps: {
  repository: HyperoomRepository;
  auth: AuthApi;
  getProfile: () => HyperoomProfile;
}): ClientCommandEngine {
  const registry = createClientCommandRegistry();
  const profile = () => deps.getProfile();

  registry.register({ name: "help", usage: "/help", description: "Show available Hyperoom commands.", handler: () => ({
    kind: "SYSTEM_EVENT",
    content: registry.all().map((item) => `${item.usage} — ${item.description}`).join("\n"),
  }) });

  registry.register({ name: "join", usage: "/join #channel", description: "Join a public channel and switch to it.", handler: async (args) => {
    if (args.length !== 1) return { kind: "ERROR", content: "Usage: /join #channel" };
    const room = await deps.repository.getRoomByName(channelName(args[0]!));
    if (!room) return { kind: "ERROR", content: `Channel not found: #${channelName(args[0]!)}` };
    await deps.repository.joinRoom(room.id);
    return { kind: "SUCCESS", content: `Joined #${room.name}`, room, data: { action: "switch-room" } };
  } });

  registry.register({ name: "part", usage: "/part", description: "Leave the active channel.", handler: async (_args, context) => {
    if (context.currentRoom === null) return { kind: "ERROR", content: "You are not in a channel." };
    await deps.repository.leaveRoom(context.currentRoom.id);
    return { kind: "SUCCESS", content: `Left #${context.currentRoom.name}`, data: { action: "part-room", roomId: context.currentRoom.id } };
  } });

  registry.register({ name: "quit", usage: "/quit", description: "End the authenticated chat session.", handler: async (_args, context) => {
    if (context.currentRoom) {
      await deps.repository.sendMessage({ roomId: context.currentRoom.id, kind: "system", eventType: "quit", content: `*** ${profile().username} quit` });
    }
    await deps.auth.signOut();
    return { kind: "SUCCESS", content: "Disconnected from Hyperoom.", data: { action: "session-ended" } };
  } });

  registry.register({ name: "me", usage: "/me <action>", description: "Send an IRC-style action message.", handler: async (args, context) => {
    const room = requireRoom(context);
    const action = args.join(" ").trim();
    if (!action) return { kind: "ERROR", content: "Usage: /me <action>" };
    await deps.repository.sendMessage({ roomId: room.id, kind: "action", eventType: "action", content: action });
    return { kind: "SUCCESS", content: "Action sent." };
  } });

  registry.register({ name: "topic", usage: "/topic [new topic]", description: "Read or change the active channel topic.", handler: async (args, context) => {
    const room = requireRoom(context);
    if (!args.length) return { kind: "SYSTEM_EVENT", content: room.topic ? `Topic for #${room.name}: ${room.topic}` : `No topic is set for #${room.name}.` };
    const nextTopic = args.join(" ").trim();
    if (nextTopic.length > 200) return { kind: "ERROR", content: "Topic cannot exceed 200 characters." };
    const updated = await deps.repository.updateRoomTopic(room.id, nextTopic || null);
    await deps.repository.sendMessage({ roomId: room.id, kind: "system", eventType: "topic", content: nextTopic ? `*** ${profile().username} changed topic to: ${nextTopic}` : `*** ${profile().username} cleared the topic` });
    return { kind: "SUCCESS", content: nextTopic ? `Topic changed for #${room.name}.` : `Topic cleared for #${room.name}.`, room: updated };
  } });

  registry.register({ name: "nick", usage: "/nick <newnick>", description: "Change your real account nickname.", handler: async (args, context) => {
    if (args.length !== 1 || !NICKNAME.test(args[0]!)) return { kind: "ERROR", content: "Usage: /nick <newnick> (2-24 letters, numbers or _)" };
    const oldNick = profile().username;
    const next = args[0]!.toLowerCase();
    if (next === oldNick) return { kind: "ERROR", content: "That is already your nickname." };
    const updated = await deps.repository.updateUsername(next);
    if (context.currentRoom) {
      await deps.repository.sendMessage({ roomId: context.currentRoom.id, kind: "system", eventType: "nick", content: `*** ${oldNick} is now known as ${updated.username}` });
    }
    return { kind: "SUCCESS", content: `You are now known as ${updated.username}.`, data: { action: "profile-updated", profile: updated } };
  } });

  registry.register({ name: "who", usage: "/who", description: "List real members of the active channel.", handler: async (_args, context) => {
    const room = requireRoom(context);
    const members = await deps.repository.listMemberProfiles(room.id);
    const lines = members.map((item) => `@${item.profile.username} — ${item.profile.displayName} [${item.role}]`);
    return { kind: "SYSTEM_EVENT", content: lines.length ? `Members in #${room.name}:\n${lines.join("\n")}` : `No members found in #${room.name}.` };
  } });

  registry.register({ name: "clear", usage: "/clear", description: "Clear the local message view without deleting history.", handler: (_args, context) => {
    if (!context.currentRoom) return { kind: "ERROR", content: "This command requires an active channel." };
    return { kind: "LOCAL_UI_ACTION", content: "Message view cleared locally.", data: { action: "clear-room", roomId: context.currentRoom.id } };
  } });

  return new ClientCommandEngine(registry);
}
