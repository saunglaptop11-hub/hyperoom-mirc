import type { HyperoomSupabaseClient } from "./client";

export async function pushNotificationEvents(client: HyperoomSupabaseClient, input: { messageId?: string; notificationIds?: string[] }): Promise<void> {
  try {
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/notifications-push", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
  } catch {
    // Push delivery is a side effect. Never block the real chat transaction.
  }
}
