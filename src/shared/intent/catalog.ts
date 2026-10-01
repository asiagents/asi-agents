/** Shared intent catalog types (server loads JSON from config/intents.catalog.json). */

export type IntentResolution = "local" | "client" | "escalate";

export interface IntentCatalogRow {
  id: string;
  handler: string;
  confirm?: boolean;
  phrases?: string[];
  keywords?: string[];
  optionalKeywords?: string[];
  negatives?: string[];
  regex?: string;
  path?: string;
}
