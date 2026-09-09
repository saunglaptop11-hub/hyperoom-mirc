import type { ParsedCommand } from "./types";

function splitCommand(input: string): { name: string; rest: string } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;
  const body = trimmed.slice(1);
  const match = body.match(/^(\S+)(?:\s+([\s\S]*))?$/);
  if (!match) return null;
  return { name: match[1]!, rest: match[2]?.trim() ?? "" };
}

function requireValue(value: string, usage: string): ParsedCommand | null {
  if (!value) return { ok: false, error: `Usage: ${usage}` };
  return null;
}

export function parseHyperoomCommand(input: string): ParsedCommand {
  const parsed = splitCommand(input);
  if (!parsed) return { ok: false, error: "Not a Hyperoom command" };
  const { name, rest } = parsed;

  switch (name) {
    case "join": {
      const error = requireValue(rest, "/join #room");
      return error ?? { ok: true, command: { type: "join", room: rest.split(/\s+/)[0]! } };
    }
    case "part":
      return { ok: true, command: { type: "part", room: rest || undefined } };
    case "msg": {
      const match = rest.match(/^(\S+)\s+([\s\S]+)$/);
      if (!match) return { ok: false, error: "Usage: /msg <target> <message>" };
      return { ok: true, command: { type: "msg", target: match[1]!, text: match[2]!.trim() } };
    }
    case "me": {
      const error = requireValue(rest, "/me <action>");
      return error ?? { ok: true, command: { type: "me", text: rest } };
    }
    case "nick": {
      const error = requireValue(rest, "/nick <nickname>");
      return error ?? { ok: true, command: { type: "nick", nickname: rest.split(/\s+/)[0]! } };
    }
    case "whois": {
      const error = requireValue(rest, "/whois <nickname>");
      return error ?? { ok: true, command: { type: "whois", nickname: rest.split(/\s+/)[0]! } };
    }
    case "mode": {
      const parts = rest.split(/\s+/).filter(Boolean);
      if (parts.length < 2) return { ok: false, error: "Usage: /mode <target> <mode> [argument]" };
      return { ok: true, command: { type: "mode", target: parts[0]!, mode: parts[1]!, argument: parts[2] } };
    }
    case "kick":
    case "ban": {
      const parts = rest.split(/\s+/).filter(Boolean);
      if (parts.length < 2) return { ok: false, error: `Usage: /${name} <room> <target> [reason]` };
      return {
        ok: true,
        command: {
          type: name,
          room: parts[0]!,
          target: parts[1]!,
          reason: parts.slice(2).join(" ") || undefined,
        },
      };
    }
    default:
      return { ok: false, error: `Unknown command: /${name}` };
  }
}
