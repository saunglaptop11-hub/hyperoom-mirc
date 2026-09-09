import type {
  IrcConnectionState,
  IrcServerConfig,
} from "@hyperoom/shared";

export * from "./protocol";

export interface IrcEngine {
  getState(): IrcConnectionState;
  connect(config: IrcServerConfig): Promise<void>;
  disconnect(): Promise<void>;
}

export function createIrcEngine(): IrcEngine {
  let state: IrcConnectionState = { status: "disconnected" };

  return {
    getState: () => state,
    async connect(config) {
      state = { status: "connecting", server: config };
      throw new Error("IRC transport is not part of Phase 1A; protocol core is active.");
    },
    async disconnect() {
      state = { status: "disconnected" };
    },
  };
}
