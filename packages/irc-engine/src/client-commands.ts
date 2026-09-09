import type { HyperoomRoom } from "@hyperoom/shared";

export type ClientCommand =
  | { type: "normal"; content: string }
  | { type: "command"; name: string; args: string[]; raw: string };

export type CommandResultKind = "SUCCESS" | "ERROR" | "SYSTEM_EVENT" | "MESSAGE" | "LOCAL_UI_ACTION";

export interface CommandResult {
  kind: CommandResultKind;
  content?: string;
  room?: HyperoomRoom;
  data?: unknown;
}

export interface ClientCommandContext {
  currentRoom: HyperoomRoom | null;
  nickname: string;
}

export type ClientCommandHandler = (
  args: string[],
  context: ClientCommandContext,
) => Promise<CommandResult> | CommandResult;

export interface ClientCommandDefinition {
  name: string;
  usage: string;
  description: string;
  handler: ClientCommandHandler;
}

export interface ClientCommandRegistry {
  register(definition: ClientCommandDefinition): void;
  get(name: string): ClientCommandDefinition | undefined;
  all(): ClientCommandDefinition[];
}

export function parseClientCommand(input: string): ClientCommand {
  const raw = input.trim();
  if (!raw.startsWith("/")) return { type: "normal", content: raw };

  const body = raw.slice(1).trim();
  if (!body) return { type: "command", name: "", args: [], raw };

  const tokens = body.split(/\s+/);
  const [name = "", ...args] = tokens;
  return { type: "command", name: name.toLowerCase(), args, raw };
}

export function createClientCommandRegistry(): ClientCommandRegistry {
  const definitions = new Map<string, ClientCommandDefinition>();
  return {
    register(definition) {
      const name = definition.name.trim().toLowerCase();
      if (!/^[a-z][a-z0-9_-]*$/.test(name)) throw new Error(`Invalid command name: ${definition.name}`);
      definitions.set(name, { ...definition, name });
    },
    get(name) { return definitions.get(name.toLowerCase()); },
    all() { return [...definitions.values()]; },
  };
}

export class ClientCommandEngine {
  constructor(private readonly registry: ClientCommandRegistry) {}

  async execute(input: string, context: ClientCommandContext): Promise<CommandResult> {
    const parsed = parseClientCommand(input);
    if (parsed.type === "normal") {
      if (!parsed.content) return { kind: "ERROR", content: "Message content cannot be empty." };
      return { kind: "MESSAGE", content: parsed.content };
    }
    if (!parsed.name) return { kind: "ERROR", content: "Command cannot be empty." };

    const definition = this.registry.get(parsed.name);
    if (!definition) return { kind: "ERROR", content: `Unknown command: /${parsed.name}` };
    try {
      return await definition.handler(parsed.args, context);
    } catch (error) {
      return { kind: "ERROR", content: error instanceof Error ? error.message : "Command failed." };
    }
  }
}
