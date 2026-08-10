import type { CategoryDef } from "@/types/categories";
import { fetchProductPage } from "@/lib/lookup/fetchPage";
import {
  extractProductFields,
  type ExtractInput,
  type LookupFields,
  type ProductLookupResult,
} from "@/lib/lookup/extract";

export type { LookupFields, ProductLookupResult, ExtractInput };
export { extractProductFields } from "@/lib/lookup/extract";
export { htmlToSpecText } from "@/lib/lookup/html";
export { cleanPastedPageText } from "@/lib/lookup/paste";
export { inferFieldsFromProductUrl } from "@/lib/lookup/urlHints";

/** Fetch a product page URL and extract name/brand/model/specs for the form. */
export async function lookupProductFromUrl(
  sourceUrl: string,
  category: CategoryDef
): Promise<ProductLookupResult> {
  const page = await fetchProductPage(sourceUrl);
  return extractProductFields({
    category,
    url: page.finalUrl.toString(),
    html: page.html,
    text: page.text ?? undefined,
  });
}

/** Parse page content captured in the user's browser (paste / clipboard). */
export function lookupProductFromBrowserCapture(
  input: { url?: string; html?: string; text?: string },
  category: CategoryDef
): ProductLookupResult {
  return extractProductFields({
    category,
    url: input.url,
    html: input.html,
    text: input.text,
  });
}
