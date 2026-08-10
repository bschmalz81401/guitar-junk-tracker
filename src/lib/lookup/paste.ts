import type { LookupFields } from "@/lib/lookup/types";
import { MULTI_WORD_BRANDS } from "@/lib/lookup/brands";

export function cleanProductTitle(title: string): string {
  return title
    .replace(/\s*[\|–—-]\s*(Sweetwater|Guitar Center|Thomann|Andertons|Reverb|Amazon|eBay|Musician'?s Friend|zZounds|Chicago Music Exchange|Vintage King|Sam Ash|Guitar Emporium).*$/i, "")
    .replace(/\s*[\|–—].{0,40}$/u, (m) => (m.length < 30 ? "" : m))
    .replace(/\s+/g, " ")
    .trim();
}

/** Nav / chrome lines that show up when users ⌘A the whole retailer page. */
export const PAGE_CHROME_LINE =
  /^(skip\s+to(\s+\w+)+|skip\s+navigation|skip\s+to\s+main\s+content|skip\s+to\s+search|skip\s+to\s+footer|contact\s+us|accessibility(\s+statement)?|cookie(\s+settings|\s+policy|\s+preferences)?|privacy\s+policy|terms(\s+of\s+(use|service))?|sign\s+in|log\s+in|log\s+out|create\s+account|my\s+account|cart|checkout|wishlist|compare|free\s+shipping|customer\s+service|help\s+center|order\s+status|track\s+order|store\s+locator|find\s+a\s+store|gift\s+cards?|financing|credit\s+card|subscribe|newsletter|menu|close|search|shop(\s+by)?|departments?|categories?|home|about\s+us|careers|returns?|shipping|faq|live\s+chat|chat\s+now|call\s+us|hours|accept(\s+all)?|reject(\s+all)?|manage\s+cookies|yes|no|ok|continue|got\s+it|dismiss|close\s+dialog|advertisement|sponsored|related\s+(products|items)|you\s+may\s+also\s+like|recently\s+viewed|customers\s+also|add\s+to\s+cart|buy\s+now|add\s+to\s+list|share|print|email|save|filter|sort\s+by|view\s+as|in\s+stock|out\s+of\s+stock|only\s+\d+\s+left|ships?\s+(free|today)|price\s+match|open\s+box|used|certified\s+used|new|sale|clearance|%\s*off|member\s+price|your\s+price|list\s+price|msrp|map|qty|quantity|reviews?|ratings?|write\s+a\s+review|q\s*&\s*a|questions?|answers?|specifications?|overview|description|features?|what'?s\s+in\s+the\s+box|warranty|support|resources|manuals?|videos?|photos?|images?|zoom|sweetwater|guitar\s+center|thomann|andertons|reverb|musician'?s\s+friend)$/i;

export const PAGE_CHROME_CONTAINS =
  /skip\s+to\s+(main|search|footer|content|navigation)|accessibility\s+statement|cookie\s+(banner|consent|settings|policy)|we\s+use\s+cookies|enable\s+javascript|browser\s+is\s+not\s+supported/i;

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
    /(?:Related\s*Products?|You\s*may\s*also\s*like|Customers?\s*also\s*(?:bought|viewed)|Recently\s*viewed)/gi,
    "\n"
  );

  // Prefer line breaks before common section headers when paste is one blob.
  t = t.replace(
    /\s{2,}(?=(Specifications?|Features?|Overview|Description|Tech\s+Specs?|Product\s+Details|What's\s+Included)\b)/gi,
    "\n"
  );

  const lines = t
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const kept: string[] = [];
  for (const line of lines) {
    if (line.length < 2) continue;
    if (PAGE_CHROME_LINE.test(line)) continue;
    if (PAGE_CHROME_CONTAINS.test(line)) continue;
    // Fragments left after nuking skip links ("To Footer", "Us", etc.)
    if (/^(to\s+)?(footer|main|search|content|navigation|menu)\b/i.test(line) && line.length < 40) {
      continue;
    }
    if (/^(us|statement|policy|settings)$/i.test(line)) continue;
    // Pure prices / stars / review summary
    if (/^\$[\d,.]+$/.test(line)) continue;
    if (/^[★☆⭐\d.\s()/]+$/.test(line)) continue;
    if (/\bout\s+of\s+5(\s+stars?)?\b/i.test(line) && line.length < 40) continue;
    // Phone numbers, emails
    if (/^\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/.test(line)) continue;
    if (/^[\w.+-]+@[\w.-]+\.\w+$/.test(line)) continue;
    // Very long legal/footer blobs
    if (line.length > 280 && !/\b(watt|tube|pickup|scale|neck|channel|impedance)\b/i.test(line)) {
      continue;
    }
    kept.push(line);
  }

  return kept.join("\n");
}

/**
 * Score a line as a likely product title. Prefers lines with known brands /
 * gear keywords and rejects nav chrome.
 */
export function scoreTitleCandidate(line: string, urlHints: LookupFields): number {
  const l = line.trim();
  if (l.length < 8 || l.length > 140) return -1;
  if (PAGE_CHROME_LINE.test(l) || PAGE_CHROME_CONTAINS.test(l)) return -1;
  if (/^https?:/i.test(l)) return -1;
  if (/^\d+$/.test(l)) return -1;

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
  if (/\b(jvm|twin|deluxe|princeton|ac30|jcm|rectifier|dual\s+rectifier)\b/i.test(l)) score += 12;

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
  if (words.length > 16) score -= 10;
  if (words.length < 2) score -= 5;

  return score;
}

export function guessProductTitle(cleanedText: string, urlHints: LookupFields): string | null {
  // URL slug is usually cleaner than page chrome — prefer it when solid.
  if (typeof urlHints.name === "string" && urlHints.name.length >= 8) {
    // Still try to find a better-cased line on the page that matches.
    const lines = cleanedText.split("\n").map((l) => l.trim()).filter(Boolean);
    let best: { line: string; score: number } | null = null;
    for (const line of lines.slice(0, 80)) {
      const score = scoreTitleCandidate(line, urlHints);
      if (score < 25) continue;
      if (!best || score > best.score) best = { line, score };
    }
    if (best && best.score >= 35) return cleanProductTitle(best.line);
    return cleanProductTitle(urlHints.name);
  }

  const lines = cleanedText.split("\n").map((l) => l.trim()).filter(Boolean);
  let best: { line: string; score: number } | null = null;
  for (const line of lines.slice(0, 100)) {
    const score = scoreTitleCandidate(line, urlHints);
    if (score < 20) continue;
    if (!best || score > best.score) best = { line, score };
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
