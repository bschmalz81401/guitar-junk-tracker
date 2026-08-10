import type { ExtractInput, LookupFields, ProductLookupResult } from "@/lib/lookup/types";
import {
  fieldsFromJsonLd,
  firstMatch,
  htmlToSpecText,
  metaContent,
} from "@/lib/lookup/html";
import { inferBrandModel } from "@/lib/lookup/brands";
import {
  brandFromVisitStoreLine,
  cleanPastedPageText,
  cleanProductTitle,
  fieldsFromMarkdown,
  guessProductTitle,
} from "@/lib/lookup/paste";
import {
  inferFieldsFromProductUrl,
  isGarbageBrandOrModel,
  isGarbageProductName,
} from "@/lib/lookup/urlHints";
import { parseSpecText } from "@/lib/specParser";

export type { ExtractInput, LookupFields, ProductLookupResult };

function applyIfEmpty(
  fields: LookupFields,
  key: string,
  value: string | number | boolean | undefined
): void {
  if (value === undefined || value === null || value === "") return;
  if (fields[key] !== undefined) return;
  fields[key] = value;
}

/** Prefer non-garbage page values over bad URL slug leftovers. */
function preferBetterIdentity(fields: LookupFields, fromPage: LookupFields): void {
  for (const key of ["name", "brand", "model"] as const) {
    const pageVal = fromPage[key];
    const current = fields[key];
    if (typeof pageVal !== "string" || !pageVal.trim()) continue;
    if (typeof current !== "string" || !current.trim()) {
      fields[key] = pageVal;
      continue;
    }
    const curBad =
      key === "name" ? isGarbageProductName(current) : isGarbageBrandOrModel(current);
    const pageBad =
      key === "name" ? isGarbageProductName(pageVal) : isGarbageBrandOrModel(pageVal);
    if (curBad && !pageBad) fields[key] = pageVal;
  }
}

function scrubIdentity(fields: LookupFields): void {
  if (typeof fields.name === "string") {
    fields.name = cleanProductTitle(fields.name);
    if (isGarbageProductName(fields.name)) delete fields.name;
  }
  if (typeof fields.brand === "string" && isGarbageBrandOrModel(fields.brand)) {
    delete fields.brand;
  }
  if (typeof fields.model === "string" && isGarbageBrandOrModel(fields.model)) {
    delete fields.model;
  }
}

function brandFromPasteLines(text: string): string | null {
  for (const line of text.split("\n").slice(0, 80)) {
    const visit = brandFromVisitStoreLine(line);
    if (visit) return visit;
    const brandLine = line.match(/^\s*brand(?:\s*name)?\s*[:\t]\s*(.+)$/i);
    if (brandLine) {
      const b = brandLine[1].replace(/\s*visit\s+the\s+.+$/i, "").trim();
      if (b && !isGarbageBrandOrModel(b) && !/^visit\b/i.test(b)) return b;
    }
  }
  return null;
}

function fillIdentityFromName(fields: LookupFields): void {
  if (typeof fields.name !== "string") return;
  const inferred = inferBrandModel(
    fields.name,
    typeof fields.brand === "string" ? fields.brand : undefined
  );
  if (inferred.brand && !fields.brand && !isGarbageBrandOrModel(inferred.brand)) {
    fields.brand = inferred.brand;
  }
  if (inferred.model && !fields.model) {
    // Cap long Amazon SEO tails as model.
    let model = inferred.model;
    if (model.length > 60) {
      const short = model.match(/^([A-Za-z0-9][A-Za-z0-9./-]*(?:\s+[A-Za-z0-9./-]{1,16}){0,4})/);
      model = short ? short[1].trim() : model.slice(0, 48).trim();
    }
    // Strip marketing ", with 30 Amp Models..." style tails.
    model = model.replace(/,?\s+with\b.+$/i, "").replace(/,?\s+for\b.+$/i, "").trim();
    if (model && !isGarbageBrandOrModel(model)) fields.model = model;
  }
}

export function extractProductFields(input: ExtractInput): ProductLookupResult {
  const html = input.html?.trim() || "";
  let text = input.text?.trim() || "";
  if (text.length > 400_000) text = text.slice(0, 400_000);

  if (!html && !text && !input.url) {
    throw new Error("Nothing to parse — provide a URL, page text, or HTML.");
  }

  const fields: LookupFields = {};

  // URL slug hints first (lowest priority — filled only into empty slots later).
  const urlHints = input.url ? inferFieldsFromProductUrl(input.url, input.category) : {};

  let finalHost = "pasted page";
  if (input.url) {
    try {
      finalHost = new URL(input.url).hostname.replace(/^www\./, "");
    } catch {
      /* ignore */
    }
  }

  if (html) {
    const ld = fieldsFromJsonLd(html);
    const jsonLdSpecs =
      typeof ld.__jsonLdSpecs === "string" ? ld.__jsonLdSpecs : null;
    const description =
      typeof ld.__description === "string" ? ld.__description : null;
    delete ld.__jsonLdSpecs;
    delete ld.__description;
    Object.assign(fields, ld);

    const ogTitle = metaContent(html, "og:title", "twitter:title");
    const docTitle = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const h1 = firstMatch(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    // Amazon product title node when HTML is available
    const amazonTitle = firstMatch(
      html,
      /id=["']productTitle["'][^>]*>([\s\S]*?)<\/(?:span|h1)>/i
    );
    let pageTitle = cleanProductTitle(amazonTitle || ogTitle || h1 || docTitle || "");

    if (text) {
      const md = fieldsFromMarkdown(text);
      if (!pageTitle && md.title) pageTitle = md.title;
      if (!fields.name && md.title) fields.name = md.title;
    }

    if (!fields.name && pageTitle) fields.name = pageTitle;

    const ogBrand = metaContent(html, "product:brand", "og:brand", "brand");
    if (!fields.brand && ogBrand) fields.brand = ogBrand;

    fillIdentityFromName(fields);

    const parts = [
      htmlToSpecText(html),
      text ? cleanPastedPageText(fieldsFromMarkdown(text).body || text) : "",
      jsonLdSpecs,
      description,
      pageTitle,
    ].filter(Boolean) as string[];

    const parsed = parseSpecText(parts.join("\n\n"), input.category);
    for (const [key, value] of Object.entries(parsed)) {
      if (key === "notes" && fields.notes) continue;
      if (fields[key] === undefined) fields[key] = value;
    }

    for (const [key, value] of Object.entries(urlHints)) {
      applyIfEmpty(fields, key, value);
    }

    scrubIdentity(fields);
    fillIdentityFromName(fields);

    if (typeof fields.notes === "string" && fields.notes.length > 500) {
      fields.notes = fields.notes.slice(0, 500).trim() + "…";
    }
    if (!fields.acquisitionSource) fields.acquisitionSource = finalHost;

    const fieldCount = Object.keys(fields).filter(
      (k) => fields[k] !== "" && fields[k] != null
    ).length;
    if (fieldCount === 0) {
      throw new Error(
        "Couldn't extract any product details. Try copying more of the product page (title + specs)."
      );
    }

    return {
      fields,
      pageTitle: pageTitle || null,
      sourceHost: finalHost,
      fieldCount,
    };
  }

  // Text-only path (browser paste of selected page content).
  if (text) {
    const md = fieldsFromMarkdown(text);
    // Strip skip-links / nav chrome from full-page ⌘A copies.
    const body = cleanPastedPageText(md.body || text);

    // Identity: best title-like line on page, then URL slug as fallback.
    const pageTitle = guessProductTitle(body, urlHints) || (md.title ? cleanProductTitle(md.title) : null);
    if (pageTitle) fields.name = pageTitle;

    // Structured identity from the page itself (Brand Name / Visit the X Store).
    const pageBrand = brandFromPasteLines(body);
    if (pageBrand) fields.brand = pageBrand;

    // Specs from cleaned body (not chrome). Skip notes — full page dumps are noisy.
    const parsed = parseSpecText(body, input.category);
    const pageIdentity: LookupFields = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key === "notes") continue;
      if (key === "brand" || key === "model" || key === "name") {
        if (typeof value === "string" && value.trim()) pageIdentity[key] = value;
        continue;
      }
      if (fields[key] === undefined) fields[key] = value;
    }

    preferBetterIdentity(fields, pageIdentity);
    // Also apply page brand/model when still empty.
    applyIfEmpty(fields, "brand", pageIdentity.brand);
    applyIfEmpty(fields, "model", pageIdentity.model);
    applyIfEmpty(fields, "name", pageIdentity.name);

    // URL hints only fill empty slots, never overwrite good page data.
    for (const [key, value] of Object.entries(urlHints)) {
      if (key === "name" || key === "brand" || key === "model") {
        if (typeof value === "string") {
          const bad =
            key === "name" ? isGarbageProductName(value) : isGarbageBrandOrModel(value);
          if (bad) continue;
        }
      }
      applyIfEmpty(fields, key, value);
    }

    scrubIdentity(fields);
    fillIdentityFromName(fields);

    // Prefer shorter model from URL SKU when paste title is long marketing text
    // and URL model is a clean code (Sweetwater JVM410H) — not an ASIN.
    if (
      typeof urlHints.model === "string" &&
      !isGarbageBrandOrModel(urlHints.model) &&
      typeof fields.model === "string" &&
      fields.model.length > urlHints.model.length + 10 &&
      urlHints.model.length <= 24
    ) {
      fields.model = urlHints.model;
    }

    if (!fields.acquisitionSource) fields.acquisitionSource = finalHost;

    // Reject garbage names that slipped through.
    if (typeof fields.name === "string" && isGarbageProductName(fields.name)) {
      if (typeof urlHints.name === "string" && !isGarbageProductName(urlHints.name)) {
        fields.name = urlHints.name;
      } else {
        delete fields.name;
      }
    }

    // Drop ASIN-ish notes if that's all we got from a bad slug parse.
    if (typeof fields.notes === "string" && /^B0[A-Z0-9]{8}$/i.test(fields.notes.trim())) {
      delete fields.notes;
    }

    const fieldCount = Object.keys(fields).filter(
      (k) => fields[k] !== "" && fields[k] != null
    ).length;
    if (fieldCount === 0) {
      throw new Error(
        "Couldn't extract any product details from that text. Include the product title and specs section."
      );
    }

    return {
      fields,
      pageTitle: typeof fields.name === "string" ? fields.name : null,
      sourceHost: finalHost,
      fieldCount,
    };
  }

  // URL-only slug hints (no page content).
  Object.assign(fields, urlHints);
  scrubIdentity(fields);
  const fieldCount = Object.keys(fields).filter(
    (k) => fields[k] !== "" && fields[k] != null
  ).length;
  if (fieldCount === 0) {
    throw new Error("Couldn't extract any product details from that URL.");
  }
  return {
    fields,
    pageTitle: typeof fields.name === "string" ? fields.name : null,
    sourceHost: finalHost,
    fieldCount,
  };
}
