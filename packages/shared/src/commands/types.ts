export type NativeHyperoomCommand =
  | { type: "join"; room: string }
  | { type: "part"; room?: string }
  | { type: "msg"; target: string; text: string }
  | { type: "me"; text: string }
  | { type: "nick"; nickname: string }
  | { type: "whois"; nickname: string }
  | { type: "mode"; target: string; mode: string; argument?: string }
  | { type: "kick"; room: string; target: string; reason?: string }
  | { type: "ban"; room: string; target: string; reason?: string };

export interface CommandParseResult {
  ok: true;
  command: NativeHyperoomCommand;
}

export interface CommandParseError {
  ok: false;
  error: string;
}

export type ParsedCommand = CommandParseResult | CommandParseError;
