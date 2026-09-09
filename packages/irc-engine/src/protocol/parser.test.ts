import { describe, expect, it } from "vitest";
import { createIrcLineParser, parseIrcLine } from "./parser";
import { serializeIrcMessage } from "./serializer";
import { IrcProtocolError } from "./types";
import { join, privmsg, user } from "./commands";

describe("IRC protocol parser", () => {
  it("parses a server prefix and numeric", () => {
    expect(parseIrcLine(":irc.example 001 Hyperoom :Welcome!\r\n")).toEqual({
      tags: new Map(), prefix: "irc.example", command: "001", params: ["Hyperoom", "Welcome!"],
    });
  });

  it("parses IRCv3 tags and escaped values", () => {
    const message = parseIrcLine("@aaa=hello\\sworld;batch;empty= :nick!u@h PRIVMSG #x :hi there");
    expect(message.tags.get("aaa")).toBe("hello world");
    expect(message.tags.get("batch")).toBeNull();
    expect(message.tags.get("empty")).toBe("");
    expect(message.prefix).toBe("nick!u@h");
    expect(message.params).toEqual(["#x", "hi there"]);
  });

  it("frames multiple messages across chunks", () => {
    const parse = createIrcLineParser();
    expect(parse(":a PING :one\r\n:b PONG :two\r\n")).toHaveLength(2);
    expect(parse("c\r")).toHaveLength(0);
    expect(parse("\n")[0]?.command).toBe("C");
  });

  it("rejects oversized input", () => {
    expect(() => parseIrcLine(`PING :${"x".repeat(510)}`)).toThrow(IrcProtocolError);
  });
});

describe("IRC protocol serializer and commands", () => {
  it("serializes trailing parameters and CRLF", () => {
    expect(serializeIrcMessage(privmsg("#cikarang", "hello bro"))).toBe("PRIVMSG #cikarang :hello bro\r\n");
  });

  it("serializes commands used during registration and channel use", () => {
    expect(serializeIrcMessage(user("hyperoom", "Hyperoom mIRC"))).toBe("USER hyperoom 0 * :Hyperoom mIRC\r\n");
    expect(serializeIrcMessage(join("#cikarang"))).toBe("JOIN #cikarang\r\n");
  });
});
