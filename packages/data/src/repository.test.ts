import { describe, expect, it, vi } from "vitest";
import type { HyperoomSupabaseClient } from "./client";
import { createHyperoomRepository } from "./repository";

function makeClient(user: { id: string } | null = { id: "u1" }) {
  const getUser = vi.fn().mockResolvedValue({ data: { user }, error: null });
  const from = vi.fn();
  return { auth: { getUser }, from } as unknown as HyperoomSupabaseClient;
}

describe("Hyperoom repository", () => {
  it("requires authentication for implicit user operations", async () => {
    const client = makeClient(null);
    const repo = createHyperoomRepository(client);
    await expect(repo.createRoom({ name: "lobby" })).rejects.toThrow("Authentication required.");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects empty messages before writing", async () => {
    const client = makeClient();
    const repo = createHyperoomRepository(client);
    await expect(repo.sendMessage({ roomId: "r1", content: "   " })).rejects.toThrow("Message content cannot be empty.");
    expect(client.from).not.toHaveBeenCalled();
  });
});
