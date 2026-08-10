import type { CategoryDef } from "@/types/categories";
import { parseSpecText } from "@/lib/specParser";
import type { ExtractInput, LookupFields, ProductLookupResult } from "@/lib/lookup/types";
import {
  fieldsFromJsonLd,
  firstMatch,
  htmlToSpecText,
  metaContent,
} from "@/lib/lookup/html";
import { inferBrandModel } from "@/lib/lookup/brands";
import {
  cleanPastedPageText,
  cleanProductTitle,
  fieldsFromMarkdown,
  guessProductTitle,
} from "@/lib/lookup/paste";
import { inferFieldsFromProductUrl, isGarbageProductName } from "@/lib/lookup/urlHints";

export type { ExtractInput, LookupFields, ProductLookupResult };

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
    let pageTitle = cleanProductTitle(ogTitle || h1 || docTitle || "");

    if (text) {
      const md = fieldsFromMarkdown(text);
      if (!pageTitle && md.title) pageTitle = md.title;
      if (!fields.name && md.title) fields.name = md.title;
    }

    if (!fields.name && pageTitle) fields.name = pageTitle;

    const ogBrand = metaContent(html, "product:brand", "og:brand", "brand");
    if (!fields.brand && ogBrand) fields.brand = ogBrand;

    if (typeof fields.name === "string") {
      const inferred = inferBrandModel(
        fields.name,
        typeof fields.brand === "string" ? fields.brand : undefined
      );
      if (inferred.brand && !fields.brand) fields.brand = inferred.brand;
      if (inferred.model && !fields.model) fields.model = inferred.model;
    }

    const parts = [
      htmlToSpecText(html),
      text,
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
      if (fields[key] === undefined) fields[key] = value;
    }

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

    // Identity: URL slug first (Sweetwater/GC), then best title-like line on page.
    const pageTitle = guessProductTitle(body, urlHints);
    if (pageTitle) fields.name = pageTitle;

    // Apply URL brand/model before inferring from title so slug SKUs win.
    if (typeof urlHints.brand === "string") fields.brand = urlHints.brand;
    if (typeof urlHints.model === "string") fields.model = urlHints.model;
    if (typeof urlHints.name === "string" && !fields.name) fields.name = urlHints.name;

    if (typeof fields.name === "string") {
      const inferred = inferBrandModel(
        fields.name,
        typeof fields.brand === "string" ? fields.brand : undefined
      );
      if (inferred.brand && !fields.brand) fields.brand = inferred.brand;
      // Prefer shorter model from URL SKU when paste title is long marketing text.
      if (inferred.model && !fields.model) fields.model = inferred.model;
    }

    // Specs only from cleaned body (not chrome). Don't let free-form leftovers
    // become notes full of "Contact Us" — drop notes from parse if chrome-heavy.
    const parsed = parseSpecText(body, input.category);
    for (const [key, value] of Object.entries(parsed)) {
      if (key === "notes") continue; // never auto-notes from a full page dump
      if (fields[key] === undefined) fields[key] = value;
    }

    // Remaining URL hints (wattage from slug, acquisitionSource, etc.)
    for (const [key, value] of Object.entries(urlHints)) {
      if (key === "name" || key === "brand" || key === "model") continue;
      if (fields[key] === undefined) fields[key] = value;
    }

    if (!fields.acquisitionSource) fields.acquisitionSource = finalHost;

    // Reject garbage names that slipped through.
    if (typeof fields.name === "string" && isGarbageProductName(fields.name)) {
      if (typeof urlHints.name === "string") fields.name = urlHints.name;
      else delete fields.name;
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
