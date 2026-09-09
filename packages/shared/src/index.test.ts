import { describe, expect, it } from "vitest";
import type { IrcServerConfig } from "./index";

describe("shared contracts", () => {
  it("defines a valid IRC server configuration shape", () => {
    const config: IrcServerConfig = {
      host: "irc.example.test",
      port: 6697,
      tls: true,
      nickname: "HyperoomUser",
      username: "hyperoom",
      realname: "Hyperoom mIRC",
    };

    expect(config.tls).toBe(true);
    expect(config.port).toBe(6697);
  });
});
