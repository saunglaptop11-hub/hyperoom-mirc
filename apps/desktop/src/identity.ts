import type { HyperoomPlatformRole } from "@hyperoom/shared";

const IDENTITY_PALETTE = ["#7dd3fc", "#a78bfa", "#86efac", "#fbbf24", "#fb7185", "#67e8f9", "#c4b5fd", "#bef264"];

export function identityColor(userId: string): string {
  let hash = 2166136261;
  for (let i = 0; i < userId.length; i += 1) hash = Math.imul(hash ^ userId.charCodeAt(i), 16777619);
  return IDENTITY_PALETTE[(hash >>> 0) % IDENTITY_PALETTE.length]!;
}

export function platformMarker(role: HyperoomPlatformRole): string {
  if (role === "owner") return "👑";
  if (role === "admin") return "🛡️";
  if (role === "moderator") return "🛡️";
  return "";
}

export function roomMarker(role: "owner" | "operator" | "voice" | "member"): string {
  if (role === "owner") return "🏠";
  if (role === "operator") return "@";
  if (role === "voice") return "+";
  return "";
}
