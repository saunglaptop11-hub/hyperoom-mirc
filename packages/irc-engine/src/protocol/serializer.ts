import { IrcMessage, IrcProtocolError } from "./types";

function encodeTagValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\:")
    .replace(/ /g, "\\s")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

export function serializeIrcMessage(message: IrcMessage): string {
  const tagEntries = [...message.tags.entries()];
  const tagPart = tagEntries.length
    ? `@${tagEntries.map(([key, value]) => value === null ? key : `${key}=${encodeTagValue(value)}`).join(";")} `
    : "";
  if (!/^[A-Z0-9]+$/i.test(message.command)) {
    throw new IrcProtocolError(`Invalid IRC command: ${message.command}`);
  }
  if (message.params.length > 15) throw new IrcProtocolError("IRC message has too many parameters");

  const parts = [message.command.toUpperCase(), ...message.params];
  const encoded = parts.map((param, index) => {
    if (index === parts.length - 1 && (param.length === 0 || /[ :\r\n]/.test(param))) return `:${param}`;
    if (/^[ :\r\n]/.test(param)) return `:${param}`;
    return param;
  });
  const prefixPart = message.prefix ? `:${message.prefix} ` : "";
  const line = `${tagPart}${prefixPart}${encoded.join(" ")}\r\n`;
  if (line.length > 512) throw new IrcProtocolError("IRC serialized line exceeds 512 characters");
  return line;
}
