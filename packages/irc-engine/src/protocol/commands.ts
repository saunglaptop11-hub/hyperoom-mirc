import type { IrcMessage } from "./types";

export function command(commandName: string, ...params: string[]): IrcMessage {
  return { tags: new Map(), command: commandName.toUpperCase(), params };
}

export const pass = (password: string) => command("PASS", password);
export const nick = (nickname: string) => command("NICK", nickname);
export const user = (username: string, realname: string) => command("USER", username, "0", "*", realname);
export const pong = (token: string) => command("PONG", token);
export const quit = (reason?: string) => command("QUIT", ...(reason === undefined ? [] : [reason]));
export const join = (channels: string, keys?: string) => command("JOIN", ...(keys === undefined ? [channels] : [channels, keys]));
export const part = (channels: string, reason?: string) => command("PART", ...(reason === undefined ? [channels] : [channels, reason]));
export const privmsg = (target: string, text: string) => command("PRIVMSG", target, text);
export const notice = (target: string, text: string) => command("NOTICE", target, text);
export const mode = (target: string, ...modes: string[]) => command("MODE", target, ...modes);
export const topic = (channel: string, text?: string) => command("TOPIC", ...(text === undefined ? [channel] : [channel, text]));
export const kick = (channel: string, nickname: string, reason?: string) => command("KICK", channel, nickname, ...(reason === undefined ? [] : [reason]));
export const invite = (nickname: string, channel: string) => command("INVITE", nickname, channel);
export const who = (mask: string) => command("WHO", mask);
export const whois = (nickname: string) => command("WHOIS", nickname);
export const away = (message?: string) => command("AWAY", ...(message === undefined ? [] : [message]));
export const cap = (subcommand: string, ...args: string[]) => command("CAP", subcommand, ...args);
