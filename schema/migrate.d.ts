export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | JsonObject;

export type JsonObject = { [key: string]: Json };

export interface MigrationCtx {
  /// simple log message.
  log: (msg: string) => void;
  /// logs a warning, potential for unexpected/non-obvious behavior.
  warn: (msg: string) => void;
  /// retrieves a key from the saved context
  get: (val: string) => unknown;
  /// saves a key value pair.
  set: (key: string, value: unknown) => void;
  /// Allows requesting external information, like a choice between two default modes
  /// specifies which key to store the answer to the prompt in.
  request: (prompt: string, default_value: Json | null, key: string) => Json;
}

export interface Migration {
  from: string;
  to: string;
  requiresUserInput: boolean;

  /// fills ctx with information and loads prompts
  gather: (old: JsonObject, ctx: MigrationCtx) => Promise<void>;
  /// creates a new object from gathered context
  migrate: (old: JsonObject, ctx: MigrationCtx) => Promise<JsonObject>;
}
