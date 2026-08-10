export type LookupFields = Record<string, string | number | boolean>;

export interface ProductLookupResult {
  fields: LookupFields;
  pageTitle: string | null;
  sourceHost: string;
  fieldCount: number;
}

export interface ExtractInput {
  category: import("@/types/categories").CategoryDef;
  url?: string;
  html?: string;
  text?: string;
}
