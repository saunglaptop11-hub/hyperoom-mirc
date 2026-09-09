export interface IrcMessage {
  tags: Map<string, string | null>;
  prefix?: string;
  command: string;
  params: string[];
}

export interface IrcParserOptions {
  maxLineLength?: number;
}

export const IRC_MAX_LINE_LENGTH = 512;

export class IrcProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IrcProtocolError";
  }
}
