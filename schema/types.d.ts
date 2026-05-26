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
  get: (val: unknown) => unknown;
  /// saves a key value pair.
  set: (key: unknown, value: unknown) => void;
  /// Allows requesting external information, like a choice between two default modes
  /// specifies which key to store the answer to the prompt in.
  request: (prompt: string, optional: boolean, key: string) => Json;
}

export interface Migration {
  from: string,
  to: string,
  requiresUserInput: boolean,

  /// fills ctx with information and loads prompts
  async gather(old, ctx);
  /// creates a new object from gathered context
  async migrate(old: JsonObject, ctx: MigrationCtx): Promise<JsonObject>;
}
