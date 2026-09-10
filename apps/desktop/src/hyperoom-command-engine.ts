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

  registry.register({ name: "help", usage: "/help", description: "Show available Hyperoom commands.", handler: () => ({ kind: "SYSTEM_EVENT", content: registry.all().map((item) => `${item.usage} — ${item.description}`).join("\n") }) });

  registry.register({ name: "create", usage: "/create #channel", description: "Create a public channel and become its Room Owner.", handler: async (args) => {
    if (args.length < 1) return { kind: "ERROR", content: "Usage: /create #channel" };
    const room = await deps.repository.createRoom({ name: channelName(args[0]!), type: "public", description: args.slice(1).join(" ") || null, isLocked: false });
    return { kind: "SUCCESS", content: `Created #${room.name}. You are the Room Owner.`, room, data: { action: "switch-room" } };
  } });

  registry.register({ name: "join", usage: "/join #channel", description: "Join a channel according to its access policy and switch to it.", handler: async (args) => {
    if (args.length !== 1) return { kind: "ERROR", content: "Usage: /join #channel" };
    const access = await deps.repository.joinRoomByName(args[0]!);
    if (access.status === "not_found") return { kind: "ERROR", content: `Channel not found: ${args[0]}` };
    if (access.status === "locked") return { kind: "ERROR", content: `*** #${args[0]!.replace(/^#/, "")} is locked.\n*** You need an invitation to join this room.` };
    if (!access.room) return { kind: "ERROR", content: "Channel access could not be resolved." };
    await deps.repository.joinRoom(access.room.id);
    return { kind: "SUCCESS", content: `Joined #${access.room.name}`, room: access.room, data: { action: "switch-room" } };
  } });

  registry.register({ name: "part", usage: "/part", description: "Leave the active channel.", handler: async (_args, context) => {
    if (!context.currentRoom) return { kind: "ERROR", content: "You are not in a channel." };
    await deps.repository.leaveRoom(context.currentRoom.id);
    return { kind: "SUCCESS", content: `Left #${context.currentRoom.name}`, data: { action: "part-room", roomId: context.currentRoom.id } };
  } });

  registry.register({ name: "quit", usage: "/quit", description: "End the authenticated chat session.", handler: async (_args, context) => {
    if (context.currentRoom) await deps.repository.sendMessage({ roomId: context.currentRoom.id, kind: "system", eventType: "quit", content: `*** ${profile().username} quit` });
    await deps.auth.signOut(); return { kind: "SUCCESS", content: "Disconnected from Hyperoom.", data: { action: "session-ended" } };
  } });

  registry.register({ name: "me", usage: "/me <action>", description: "Send an IRC-style action message.", handler: async (args, context) => {
    const room = requireRoom(context); const action = args.join(" ").trim();
    if (!action) return { kind: "ERROR", content: "Usage: /me <action>" };
    await deps.repository.sendMessage({ roomId: room.id, kind: "action", eventType: "action", content: action }); return { kind: "SUCCESS", content: "Action sent." };
  } });

  registry.register({ name: "topic", usage: "/topic [new topic]", description: "Read or change the active channel topic.", handler: async (args, context) => {
    const room = requireRoom(context); if (!args.length) return { kind: "SYSTEM_EVENT", content: room.topic ? `Topic for #${room.name}: ${room.topic}` : `No topic is set for #${room.name}.` };
    const nextTopic = args.join(" ").trim(); if (nextTopic.length > 200) return { kind: "ERROR", content: "Topic cannot exceed 200 characters." };
    const updated = await deps.repository.updateRoomTopic(room.id, nextTopic || null);
    await deps.repository.sendMessage({ roomId: room.id, kind: "system", eventType: "topic", content: nextTopic ? `*** ${profile().username} changed topic to: ${nextTopic}` : `*** ${profile().username} cleared the topic` });
    return { kind: "SUCCESS", content: nextTopic ? `Topic changed for #${room.name}.` : `Topic cleared for #${room.name}.`, room: updated };
  } });

  registry.register({ name: "lock", usage: "/lock", description: "Lock the active channel (Room Owner or platform authority).", handler: async (_args, context) => {
    const room = requireRoom(context); if (room.isLocked) return { kind: "ERROR", content: `#${room.name} is already locked.` };
    const updated = await deps.repository.updateRoom(room.id, { isLocked: true });
    await deps.repository.sendMessage({ roomId: room.id, kind: "system", eventType: "lock", content: `*** Room #${room.name} is now locked` });
    return { kind: "SUCCESS", content: `#${room.name} is now locked.`, room: updated };
  } });

  registry.register({ name: "unlock", usage: "/unlock", description: "Unlock the active channel (Room Owner or platform authority).", handler: async (_args, context) => {
    const room = requireRoom(context); if (!room.isLocked) return { kind: "ERROR", content: `#${room.name} is already public.` };
    const updated = await deps.repository.updateRoom(room.id, { isLocked: false });
    await deps.repository.sendMessage({ roomId: room.id, kind: "system", eventType: "unlock", content: `*** Room #${room.name} is now unlocked` });
    return { kind: "SUCCESS", content: `#${room.name} is now unlocked.`, room: updated };
  } });

  registry.register({ name: "room", usage: "/room name|description <value>", description: "Edit the active room name or description.", handler: async (args, context) => {
    const room = requireRoom(context); const [field, ...rest] = args; const value = rest.join(" ").trim();
    if (!field || !value || !["name", "description"].includes(field.toLowerCase())) return { kind: "ERROR", content: "Usage: /room name <name> OR /room description <text>" };
    const updated = await deps.repository.updateRoom(room.id, field.toLowerCase() === "name" ? { name: value } : { description: value });
    await deps.repository.sendMessage({ roomId: room.id, kind: "system", eventType: "topic", content: `*** ${profile().username} updated room ${field.toLowerCase()}` });
    return { kind: "SUCCESS", content: `Room ${field.toLowerCase()} updated.`, room: updated };
  } });

  registry.register({ name: "nick", usage: "/nick <newnick>", description: "Change your real account nickname.", handler: async (args, context) => {
    if (args.length !== 1 || !NICKNAME.test(args[0]!)) return { kind: "ERROR", content: "Usage: /nick <newnick> (2-24 letters, numbers or _)" };
    const oldNick = profile().username; const next = args[0]!.toLowerCase(); if (next === oldNick) return { kind: "ERROR", content: "That is already your nickname." };
    const updated = await deps.repository.updateUsername(next); if (context.currentRoom) await deps.repository.sendMessage({ roomId: context.currentRoom.id, kind: "system", eventType: "nick", content: `*** ${oldNick} is now known as ${updated.username}` });
    return { kind: "SUCCESS", content: `You are now known as ${updated.username}.`, data: { action: "profile-updated", profile: updated } };
  } });

  registry.register({ name: "who", usage: "/who", description: "List real members of the active channel.", handler: async (_args, context) => {
    const room = requireRoom(context); const members = await deps.repository.listMemberProfiles(room.id);
    const lines = members.map((item) => `@${item.profile.username} — ${item.profile.displayName} [${item.role}]`);
    return { kind: "SYSTEM_EVENT", content: lines.length ? `Members in #${room.name}:\n${lines.join("\n")}` : `No members found in #${room.name}.` };
  } });

  registry.register({ name: "clear", usage: "/clear", description: "Clear the local message view without deleting history.", handler: (_args, context) => {
    if (!context.currentRoom) return { kind: "ERROR", content: "This command requires an active channel." };
    return { kind: "LOCAL_UI_ACTION", content: "Message view cleared locally.", data: { action: "clear-room", roomId: context.currentRoom.id } };
  } });

  return new ClientCommandEngine(registry);
}
