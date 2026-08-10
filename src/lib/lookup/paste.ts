import type { LookupFields } from "@/lib/lookup/types";
import { MULTI_WORD_BRANDS } from "@/lib/lookup/brands";

/** Local garbage checks — keep free of imports from urlHints (avoids cycles). */
function looksLikeBadTitle(name: string): boolean {
  const n = name.trim();
  if (n.length < 4 || n.length > 160) return true;
  if (/^B0[A-Z0-9]{8}$/i.test(n)) return true;
  if (/^\$[\d,.]+/.test(n)) return true;
  if (/^(dp|gp|asin|ref|cart|checkout)$/i.test(n)) return true;
  return false;
}

export function cleanProductTitle(title: string): string {
  let t = title
    // Retailer suffixes
    .replace(
      /\s*[\|–—-]\s*(Sweetwater|Guitar Center|Thomann|Andertons|Reverb|Amazon(?:\.(?:com|co\.uk|ca|de))?|eBay|Musician'?s Friend|zZounds|Chicago Music Exchange|Vintage King|Sam Ash|Guitar Emporium).*$/i,
      ""
    )
    .replace(/\s*[\|–—].{0,40}$/u, (m) => (m.length < 30 ? "" : m));

  // Prices / savings glued onto titles (common in Amazon full-page pastes)
  t = t
    .replace(/\s*\$\s*[\d,]+(?:\.\d{2})?(?:\s*(?:USD|CAD|GBP|EUR))?/gi, " ")
    .replace(/\s*(?:list\s*price|was|you\s*save|save)\s*:?\s*\$?[\d,.]+/gi, " ")
    .replace(/\s*\(\s*\d+\s*%\s*(?:off|savings?)?\s*\)/gi, " ")
    .replace(/\s*with\s+\d+\s+percent\s+savings?/gi, " ");

  // Star ratings / review crumbs
  t = t
    .replace(/\s*\d(?:\.\d)?\s*out\s+of\s+5(?:\s+stars?)?/gi, " ")
    .replace(/\s*[\d,]+\s+ratings?\b/gi, " ")
    .replace(/\s*[★☆⭐]+/g, " ");

  // Amazon store link crumbs
  t = t
    .replace(/\bvisit\s+the\s+.+\s+store\b/gi, " ")
    .replace(/\bbrand\s*:\s*/gi, " ");

  // Trailing marketplace noise
  t = t
    .replace(/\s*[\(\[]\s*(renewed|refurbished|open\s*box|used|certified\s+refurbished)\s*[\)\]]\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    // Trailing commas left after stripping price tails
    .replace(/[,\s:;|-]+$/g, "")
    .trim();

  // Amazon SEO tails after the core product name: ", 25 Watts, with 30 Amp Models…"
  // Keep a short brand + model + form phrase; drop feature laundry lists.
  if (/,\s*with\b/i.test(t)) {
    const trimmed = t.replace(/,?\s+with\b.+$/i, "").trim();
    if (trimmed.length >= 12) t = trimmed;
  }
  // Drop trailing ", 25 Watts" / ", Black" feature crumbs (wattage lives in specs).
  t = t
    .replace(/,\s*\d+\s*w(?:att)?s?\b.*$/i, "")
    .replace(/,\s*(black|white|natural|sunburst|red|blue)\s*$/i, "")
    .trim();

  return t;
}

/** Nav / chrome lines that show up when users ⌘A the whole retailer page. */
export const PAGE_CHROME_LINE =
  /^(skip\s+to(\s+\w+)+|skip\s+to\s+main\s+content|skip\s+navigation|skip\s+to\s+search|skip\s+to\s+footer|contact\s+us|accessibility(\s+statement)?|cookie(\s+settings|\s+policy|\s+preferences)?|privacy\s+policy|terms(\s+of\s+(use|service))?|sign\s+in|log\s+in|log\s+out|create\s+account|my\s+account|cart|checkout|wishlist|compare|free\s+shipping|customer\s+service|help\s+center|order\s+status|track\s+order|store\s+locator|find\s+a\s+store|gift\s+cards?|financing|credit\s+card|subscribe|newsletter|menu|close|search|shop(\s+by)?|departments?|categories?|home|about\s+us|careers|returns?|shipping|faq|live\s+chat|chat\s+now|call\s+us|hours|accept(\s+all)?|reject(\s+all)?|manage\s+cookies|yes|no|ok|continue|got\s+it|dismiss|close\s+dialog|advertisement|sponsored|related\s+(products|items)|you\s+may\s+also\s+like|recently\s+viewed|customers\s+also|add\s+to\s+cart|buy\s+now|add\s+to\s+list|share|print|email|save|filter|sort\s+by|view\s+as|in\s+stock|out\s+of\s+stock|only\s+\d+\s+left|ships?\s+(free|today)|price\s+match|open\s+box|used|certified\s+used|new|sale|clearance|%\s*off|member\s+price|your\s+price|list\s+price|msrp|map|qty|quantity|reviews?|ratings?|write\s+a\s+review|q\s*&\s*a|questions?|answers?|specifications?|overview|description|features?|what'?s\s+in\s+the\s+box|warranty|support|resources|manuals?|videos?|photos?|images?|zoom|sweetwater|guitar\s+center|thomann|andertons|reverb|musician'?s\s+friend|deliver\s+to|hello,?\s+sign\s+in|account\s*&\s*lists|all|secure\s+transaction|ships?\s+from|sold\s+by|return\s+policy|30-day\s+refund|climate\s+pledge|amazon'?s?\s+choice|best\s+seller|#\d+\s+best\s+seller|get\s+fast,?\s+free\s+shipping|with\s+amazon\s+prime|prime|subscribe\s*&\s*save|frequently\s+bought\s+together|customers?\s+who\s+(viewed|bought)|product\s+information|technical\s+details|additional\s+information|warranty\s*&\s*support|product\s+description|from\s+the\s+manufacturer|top\s+reviews|global\s+store|other\s+sellers|see\s+all\s+buying\s+options|compare\s+with\s+similar|bundle\s+offer|style:|size:|color:|pattern\s+name:|configuration:|qty:|quantity:)$/i;

export const PAGE_CHROME_CONTAINS =
  /skip\s+to\s+(main|search|footer|content|navigation)|accessibility\s+statement|cookie\s+(banner|consent|settings|policy)|we\s+use\s+cookies|enable\s+javascript|browser\s+is\s+not\s+supported|customers?\s+who\s+(viewed|bought)\s+this|frequently\s+bought\s+together|get\s+fast,?\s+free\s+shipping|amazon\s+prime|climate\s+pledge\s+friendly|function\s*\(|\{[\s\S]*\}|©\s*\d{4}/i;

/** Extract brand from Amazon's "Visit the Fender Store" line. */
export function brandFromVisitStoreLine(line: string): string | null {
  const m = line.match(/^\s*visit\s+the\s+(.+?)\s+store\s*$/i);
  if (!m) return null;
  const brand = m[1].trim();
  if (brand.length < 2 || brand.length > 40) return null;
  if (/^(amazon|seller|brand)$/i.test(brand)) return null;
  return brand;
}

/**
 * Normalize a full-page paste: split glued skip-links, drop chrome, keep
 * product-ish lines for title + spec parsing.
 */
export function cleanPastedPageText(raw: string): string {
  let t = raw.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");

  // Nuke common skip-link phrases even when glued together without spaces.
  t = t.replace(
    /Skip\s*To\s*(?:Main\s*Content|Search|Footer|Navigation|Content|Menu)/gi,
    "\n"
  );
  t = t.replace(
    /(?:Contact\s*Us|Accessibility(?:\s*Statement)?|Privacy\s*Policy|Terms(?:\s*of\s*(?:Use|Service))?|Sign\s*In|Log\s*In|Create\s*Account|My\s*Account|Store\s*Locator|Find\s*a\s*Store|Gift\s*Cards?|Cookie\s*(?:Settings|Policy|Preferences)?)/gi,
    "\n"
  );
  t = t.replace(/(Add\s*to\s*Cart|Buy\s*Now|Add\s*to\s*List|Free\s*Shipping)/gi, "\n");
  t = t.replace(
    /(?:Related\s*Products?|You\s*may\s*also\s*like|Customers?\s*also\s*(?:bought|viewed)|Recently\s*viewed|Customers?\s*who\s+(?:viewed|bought)(?:\s+this\s+item)?(?:\s+also\s+viewed)?|Frequently\s*bought\s*together)/gi,
    "\n---RELATED---\n"
  );

  // Amazon delivery / seller chrome often glued mid-paste
  t = t.replace(
    /(?:Ships?\s*from|Sold\s*by|Deliver\s*to|Get\s*Fast,?\s*Free\s*Shipping|In\s*Stock|Only\s*\d+\s*left)[^\n]{0,80}/gi,
    "\n"
  );

  // Prefer line breaks before common section headers when paste is one blob.
  t = t.replace(
    /\s{2,}(?=(Specifications?|Features?|Overview|Description|Tech\s+Specs?|Product\s+Details|Product\s+information|Technical\s+Details|About\s+this\s+item|What's\s+Included)\b)/gi,
    "\n"
  );

  // Split Amazon "About this item" bullets that sometimes arrive as one long line.
  t = t.replace(/\s*[•·▪]\s*/g, "\n");

  const lines = t
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const kept: string[] = [];
  let inRelated = false;
  for (const line of lines) {
    if (line.length < 2) continue;
    // Drop everything after related-product / "customers also" blocks — those
    // lines look like real product titles and steal identity fields.
    if (
      /^---RELATED---$/.test(line) ||
      (PAGE_CHROME_CONTAINS.test(line) &&
        /customers?\s+who|frequently\s+bought|related\s+product/i.test(line))
    ) {
      inRelated = true;
      continue;
    }
    if (inRelated) continue;
    if (PAGE_CHROME_LINE.test(line)) continue;
    if (PAGE_CHROME_CONTAINS.test(line)) continue;
    // Fragments left after nuking skip links ("To Footer", "Us", etc.)
    if (/^(to\s+)?(footer|main|search|content|navigation|menu)\b/i.test(line) && line.length < 40) {
      continue;
    }
    if (/^(us|statement|policy|settings)$/i.test(line)) continue;
    // Pure prices / stars / review summary
    if (/^\$[\d,.]+$/.test(line)) continue;
    if (/^(?:list\s*price|price|you\s*save|was)\s*:?\s*\$?[\d,.]+$/i.test(line)) continue;
    if (/^[★☆⭐\d.\s()/]+$/.test(line)) continue;
    if (/\bout\s+of\s+5(\s+stars?)?\b/i.test(line) && line.length < 50) continue;
    if (/^[\d,.]+\s+ratings?\b/i.test(line)) continue;
    // ASIN-only lines
    if (/^B0[A-Z0-9]{8}$/i.test(line)) continue;
    if (/^ASIN\s*:?\s*B0[A-Z0-9]{8}$/i.test(line)) continue;
    // Phone numbers, emails
    if (/^\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/.test(line)) continue;
    if (/^[\w.+-]+@[\w.-]+\.\w+$/.test(line)) continue;
    // Best sellers rank / category browse crumbs
    if (/^#?[\d,]+\s+in\b/i.test(line) && line.length < 80) continue;
    if (/^best\s+sellers?\s+rank\b/i.test(line)) continue;
    // Date first available alone is not useful as a "spec" line for gear
    // (still keep "Date First Available\t..." tab form for completeness — skip pure noise)
    if (/^function\b|^\s*var\s+|^\s*window\./i.test(line)) continue;
    // Very long legal/footer blobs
    if (line.length > 280 && !/\b(watt|tube|pickup|scale|neck|channel|impedance|speaker|amp|guitar)\b/i.test(line)) {
      continue;
    }
    kept.push(line);
  }

  return kept.join("\n");
}

/**
 * Score a line as a likely product title. Prefers lines with known brands /
 * gear keywords and rejects nav chrome, pure prices, and review crumbs.
 * Prices glued onto an otherwise-good title are stripped for scoring (common
 * on Amazon ⌘A pastes).
 */
export function scoreTitleCandidate(line: string, urlHints: LookupFields): number {
  const raw = line.trim();
  // Score the cleaned form so "$199.99" tails don't disqualify real titles.
  const l = cleanProductTitle(raw);
  if (l.length < 8 || l.length > 160) return -1;
  if (PAGE_CHROME_LINE.test(l) || PAGE_CHROME_CONTAINS.test(l)) return -1;
  if (/^https?:/i.test(l)) return -1;
  if (/^\d+$/.test(l)) return -1;
  if (/^\$/.test(l)) return -1;
  if (looksLikeBadTitle(l)) return -1;
  // Pure price / rating / cart lines are never titles
  if (/^\$\s*[\d,]+/.test(raw) && l.length < 12) return -1;
  if (/\bout\s+of\s+5\b/i.test(l)) return -1;
  if (/^\s*(add\s+to\s+cart|buy\s+now|list\s*price|ships?\s+from|sold\s+by)\b/i.test(l)) return -1;
  if (/^\s*visit\s+the\s+/i.test(l)) return -1;
  if (/^\s*brand\s*(name)?\s*:/i.test(l)) return -1;

  let score = 0;
  // Known brand at start is a strong signal.
  for (const brand of MULTI_WORD_BRANDS) {
    if (l.toLowerCase().startsWith(brand.toLowerCase())) {
      score += 40 + brand.length;
      break;
    }
  }
  if (/\b(amp|amplifier|head|combo|guitar|bass|pedal|cabinet|cab|watt|tube|valve|solid[\s-]?state)\b/i.test(l)) {
    score += 15;
  }
  if (/\b\d+\s*w(att)?s?\b/i.test(l)) score += 10;
  if (/\b(jvm|twin|deluxe|princeton|ac30|jcm|rectifier|dual\s+rectifier|mustang|helix|katana)\b/i.test(l)) {
    score += 12;
  }

  // Prefer matching URL slug tokens when we have them.
  if (typeof urlHints.model === "string") {
    const m = urlHints.model.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const hits = m.filter((w) => l.toLowerCase().includes(w)).length;
    score += hits * 8;
  }
  if (typeof urlHints.brand === "string" && l.toLowerCase().includes(urlHints.brand.toLowerCase())) {
    score += 20;
  }
  if (typeof urlHints.name === "string") {
    const tokens = urlHints.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const hits = tokens.filter((w) => l.toLowerCase().includes(w)).length;
    score += hits * 3;
  }

  // Title Case / product-y casing
  if (/^[A-Z0-9]/.test(l)) score += 3;
  // Penalize lines that look like sentences (too many small words)
  const words = l.split(/\s+/);
  if (words.length > 18) score -= 12;
  if (words.length > 22) score -= 15;
  if (words.length < 2) score -= 5;
  // Amazon SEO titles are long but still valid — mild penalty only
  if (words.length > 12 && words.length <= 18) score -= 3;

  // Spec-table rows ("Brand Name Fender") are not titles
  if (/^(brand|item|product|output|power|material|manufacturer|asin|date)\b/i.test(l) && words.length <= 6) {
    score -= 25;
  }

  return score;
}

export function guessProductTitle(cleanedText: string, urlHints: LookupFields): string | null {
  const lines = cleanedText.split("\n").map((l) => l.trim()).filter(Boolean);

  // Prefer earlier lines when scores tie — the real product title is almost
  // always above "customers also viewed" / related-item blocks.
  let best: { line: string; score: number; index: number } | null = null;
  for (let i = 0; i < Math.min(lines.length, 120); i++) {
    const line = lines[i];
    const score = scoreTitleCandidate(line, urlHints);
    if (score < 20) continue;
    // Mild position bonus so the primary product beats later related items
    // with similar brand/keyword density.
    const adjusted = score + Math.max(0, 8 - Math.floor(i / 5));
    if (
      !best ||
      adjusted > best.score ||
      (adjusted === best.score && i < best.index)
    ) {
      best = { line, score: adjusted, index: i };
    }
  }

  if (best && best.score >= 35) {
    return cleanProductTitle(best.line);
  }

  // URL slug is usually cleaner than page chrome — use when solid and page title weak.
  if (typeof urlHints.name === "string" && urlHints.name.length >= 8 && !looksLikeBadTitle(urlHints.name)) {
    if (best && best.score >= 25) return cleanProductTitle(best.line);
    return cleanProductTitle(urlHints.name);
  }

  return best ? cleanProductTitle(best.line) : null;
}

export function fieldsFromMarkdown(md: string): { title: string | null; body: string } {
  // Jina reader format:
  // Title: ...
  // URL Source: ...
  // Markdown Content:
  // ...
  let title: string | null = null;
  const titleMatch = md.match(/^Title:\s*(.+)$/im);
  if (titleMatch) title = cleanProductTitle(titleMatch[1].trim());

  let body = md;
  const contentIdx = md.search(/^Markdown Content:\s*$/im);
  if (contentIdx >= 0) {
    body = md.slice(contentIdx).replace(/^Markdown Content:\s*/i, "");
  }
  // Drop jina chrome lines
  body = body
    .replace(/^Title:.*$/gim, "")
    .replace(/^URL Source:.*$/gim, "")
    .replace(/^Warning:.*$/gim, "")
    .replace(/^Published Time:.*$/gim, "")
    .trim();

  return { title, body };
}
