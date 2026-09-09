import {
  IRC_MAX_LINE_LENGTH,
  IrcMessage,
  IrcParserOptions,
  IrcProtocolError,
} from "./types";

function parseTags(raw: string): Map<string, string | null> {
  const tags = new Map<string, string | null>();
  if (!raw) return tags;
  for (const item of raw.split(";")) {
    const separator = item.indexOf("=");
    const key = separator === -1 ? item : item.slice(0, separator);
    const value = separator === -1 ? null : decodeTagValue(item.slice(separator + 1));
    if (!key) throw new IrcProtocolError("IRC tag name cannot be empty");
    tags.set(key, value);
  }
  return tags;
}

function decodeTagValue(value: string): string {
  return value.replace(/\\([:\\s])/g, (_, escaped: string) =>
    escaped === ":" ? ";" : escaped === "s" ? " " : escaped,
  ).replace(/\\r/g, "\r").replace(/\\n/g, "\n");
}

export function parseIrcLine(line: string, options: IrcParserOptions = {}): IrcMessage {
  const max = options.maxLineLength ?? IRC_MAX_LINE_LENGTH;
  const normalized = line.endsWith("\r\n") ? line.slice(0, -2) : line.replace(/\r?\n$/, "");
  if (normalized.length > max) throw new IrcProtocolError(`IRC line exceeds ${max} characters`);
  if (!normalized) throw new IrcProtocolError("IRC line cannot be empty");

  let cursor = 0;
  const tags = new Map<string, string | null>();
  if (normalized[cursor] === "@") {
    const end = normalized.indexOf(" ", cursor);
    if (end === -1) throw new IrcProtocolError("IRC tag section must be followed by a command");
    for (const [key, value] of parseTags(normalized.slice(cursor + 1, end))) tags.set(key, value);
    cursor = end + 1;
  }

  let prefix: string | undefined;
  if (normalized[cursor] === ":") {
    const end = normalized.indexOf(" ", cursor);
    if (end === -1) throw new IrcProtocolError("IRC prefix must be followed by a command");
    prefix = normalized.slice(cursor + 1, end);
    if (!prefix) throw new IrcProtocolError("IRC prefix cannot be empty");
    cursor = end + 1;
  }

  while (normalized[cursor] === " ") cursor += 1;
  const commandEnd = normalized.indexOf(" ", cursor);
  const command = (commandEnd === -1 ? normalized.slice(cursor) : normalized.slice(cursor, commandEnd)).toUpperCase();
  if (!/^[A-Z0-9]+$/.test(command)) throw new IrcProtocolError(`Invalid IRC command: ${command}`);
  cursor = commandEnd === -1 ? normalized.length : commandEnd + 1;

  const params: string[] = [];
  while (cursor < normalized.length) {
    while (normalized[cursor] === " ") cursor += 1;
    if (cursor >= normalized.length) break;
    if (normalized[cursor] === ":") {
      params.push(normalized.slice(cursor + 1));
      break;
    }
    const end = normalized.indexOf(" ", cursor);
    if (end === -1) {
      params.push(normalized.slice(cursor));
      break;
    }
    params.push(normalized.slice(cursor, end));
    cursor = end + 1;
  }

  return { tags, ...(prefix ? { prefix } : {}), command, params };
}

export function createIrcLineParser(options: IrcParserOptions = {}) {
  let buffer = "";
  return (chunk: string): IrcMessage[] => {
    buffer += chunk;
    const messages: IrcMessage[] = [];
    while (true) {
      const end = buffer.indexOf("\r\n");
      if (end === -1) break;
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      messages.push(parseIrcLine(line, options));
    }
    if (buffer.length > (options.maxLineLength ?? IRC_MAX_LINE_LENGTH)) {
      throw new IrcProtocolError("IRC receive buffer exceeded maximum line length");
    }
    return messages;
  };
}
