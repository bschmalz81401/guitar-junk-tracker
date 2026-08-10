import type { CategoryDef, CategoryKey, SpecFieldType } from "@/types/categories";
import { SYNONYMS, type SynonymEntry } from "@/lib/parser/synonyms";

const TRUE_WORDS = new Set([
  "yes",
  "true",
  "included",
  "y",
  "standard",
  "built-in",
  "built in",
  "available",
  "footswitchable",
  "switchable",
]);
const FALSE_WORDS = new Set(["no", "false", "none", "n", "n/a", "not included", "na", "not available"]);

/** Strip bullets / list markers so free-form feature lists parse cleanly. */
function stripListPrefix(line: string): string {
  return line
    .replace(/^[\s]*[-*•–—▪▸►·]+[\s]+/, "")
    .replace(/^[\s]*\d+[.)]\s+/, "")
    .replace(/^[\s]*[a-z][.)]\s+/i, "")
    .trim();
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[:*]+$/, "")
    .trim()
    .replace(/\s+/g, " ");
}

/** True when `pattern` appears in `text` as a whole phrase (not a substring of a longer word). */
function containsPhrase(text: string, pattern: string): boolean {
  const escaped = pattern
    .toLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?![a-z0-9])`, "i").test(text);
}

function matchField(label: string, entries: SynonymEntry[]): string | null {
  const norm = normalizeLabel(label);
  if (!norm) return null;

  // Exact pattern match first (longest patterns win later for includes).
  for (const entry of entries) {
    if (entry.patterns.includes(norm)) return entry.field;
  }

  let best: { field: string; len: number } | null = null;
  for (const entry of entries) {
    for (const pattern of entry.patterns) {
      if (containsPhrase(norm, pattern) && (!best || pattern.length > best.len)) {
        best = { field: entry.field, len: pattern.length };
      }
    }
  }
  return best?.field ?? null;
}

function coerceValue(
  type: SpecFieldType | undefined,
  value: string
): string | number | boolean | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (type === "number") {
    const num = parseFloat(trimmed.replace(/[^0-9.]/g, ""));
    return Number.isNaN(num) ? null : num;
  }

  if (type === "boolean") {
    const v = trimmed.toLowerCase();
    if (FALSE_WORDS.has(v)) return false;
    if (TRUE_WORDS.has(v)) return true;
    // Descriptive values ("with level control", "footswitchable") imply present.
    if (/^not\b|without\b|no\b/.test(v)) return false;
    return true;
  }

  return trimmed;
}

/**
 * Pull structured values out of free-form prose lines like
 * "120W tube power" or "3 footswitchable channels".
 */
function extractEmbeddedValues(
  line: string,
  category: CategoryKey
): Record<string, string | number | boolean> {
  const lower = line.toLowerCase();
  const out: Record<string, string | number | boolean> = {};

  // Wattage: "120W", "100 watts", "50W tube power"
  const watt = lower.match(/\b(\d+(?:\.\d+)?)\s*w(?:att(?:s)?)?\b/);
  if (watt && (category === "amp" || category === "cab" || category === "pedal")) {
    const n = Number(watt[1]);
    if (category === "amp") out.wattage = n;
    if (category === "cab") out.powerHandling = n;
  }

  // Channels: "3 channels", "3 footswitchable channels", "dual channel"
  if (category === "amp") {
    const ch = lower.match(/\b(\d+)\s*(?:footswitchable\s+|switchable\s+)?channels?\b/);
    if (ch) {
      out.channels = Number(ch[1]);
    } else if (/\bdual[\s-]channel\b/.test(lower)) {
      out.channels = 2;
    } else if (/\btriple[\s-]channel\b|\bthree[\s-]channel\b/.test(lower)) {
      out.channels = 3;
    } else if (/\bsingle[\s-]channel\b/.test(lower)) {
      out.channels = 1;
    }

    // Amp type from common phrases
    if (/\b(all[\s-]?tube|tube(?:\s+power)?|valve)\b/.test(lower) && !/\bsolid[\s-]?state\b/.test(lower)) {
      out.ampType = /all[\s-]?tube/.test(lower) ? "All-tube" : "Tube";
    } else if (/\bsolid[\s-]?state\b|\bss\b/.test(lower)) {
      out.ampType = "Solid state";
    } else if (/\bhybrid\b/.test(lower)) {
      out.ampType = "Hybrid";
    } else if (/\bdigital\b|\bmodeling\b|\bmodeller\b|\bmodeler\b/.test(lower)) {
      out.ampType = "Digital / modeling";
    }

    // Form factor
    if (/\bcombo\b/.test(lower)) out.formFactor = "Combo";
    else if (/\bhead\b/.test(lower) && !/\bheadphone\b/.test(lower)) out.formFactor = "Head";
    else if (/\brack\b/.test(lower)) out.formFactor = "Rack";

    // Combo speaker shorthand: "1x12", "2x12 combo"
    const spk = lower.match(/\b(\d)\s*[x×]\s*(8|10|12|15)\b/);
    if (spk) {
      out.speakerCount = Number(spk[1]);
      out.speakerSize = `${spk[2]}"`;
    }
  }

  if (category === "cab") {
    const cfg = lower.match(/\b(\d)\s*[x×]\s*(8|10|12|15)\b/);
    if (cfg) {
      out.speakerCount = Number(cfg[1]);
      out.speakerSize = `${cfg[2]}"`;
    }
    if (/\bopen[\s-]?back\b/.test(lower)) out.cabType = "Open back";
    else if (/\bclosed[\s-]?back\b|\bsealed\b/.test(lower)) out.cabType = "Closed back";
  }

  if (category === "guitar") {
    const frets = lower.match(/\b(\d{2})\s*frets?\b/);
    if (frets) out.fretCount = Number(frets[1]);
    const scale = lower.match(/\b(\d{2}(?:\.\d+)?)\s*(?:["”]|inch(?:es)?)?\s*scale\b/);
    if (scale) out.scaleLength = `${scale[1]}"`;
  }

  if (category === "pedal") {
    const ma = lower.match(/\b(\d+)\s*mA\b/i) || line.match(/\b(\d+)\s*mA\b/);
    if (ma) out.currentDraw = Number(ma[1]);
    if (/\btrue\s+bypass\b/.test(lower)) out.trueBypass = true;
    if (/\bbuffered\s+bypass\b/.test(lower)) out.trueBypass = false;
  }

  // Weight: "28 lbs", "12.5 lb", "9 kg" (converted roughly for kg)
  const lbs = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\b/);
  if (lbs) out.weightLbs = Number(lbs[1]);
  const kg = lower.match(/\b(\d+(?:\.\d+)?)\s*kg\b/);
  if (kg && out.weightLbs === undefined) {
    out.weightLbs = Math.round(Number(kg[1]) * 2.20462 * 10) / 10;
  }

  // Impedance: "8 ohm", "4/8/16Ω"
  const z = line.match(/\b(\d+(?:\s*\/\s*\d+)*)\s*(?:ohm|ohms|Ω)\b/i);
  if (z && (category === "amp" || category === "cab")) {
    out.impedance = `${z[1].replace(/\s+/g, "")}Ω`;
  }

  return out;
}

/**
 * Detect boolean (and simple text) feature mentions in a free-form line.
 * Returns fields that the line is asserting as present / described.
 */
function extractFeatureMentions(
  line: string,
  entries: SynonymEntry[],
  fieldTypes: Record<string, SpecFieldType>
): Record<string, string | number | boolean> {
  let remaining = line.toLowerCase();
  const out: Record<string, string | number | boolean> = {};

  // Prefer longer patterns so "effects loop" wins over "loop", etc.
  const ranked = entries
    .flatMap((e) => e.patterns.map((p) => ({ field: e.field, pattern: p })))
    .sort((a, b) => b.pattern.length - a.pattern.length);

  const claimed = new Set<string>();

  for (const { field, pattern } of ranked) {
    if (claimed.has(field)) continue;
    if (!containsPhrase(remaining, pattern)) continue;

    // Avoid weak short matches on long prose.
    if (pattern.length < 4 && remaining.length > pattern.length + 8) continue;

    // "not included" / "no master volume" style negations for this phrase.
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const neg = new RegExp(`(?:\\b(?:no|not|without|w\\/o)\\s+)${escaped}`, "i");
    if (neg.test(remaining)) {
      if (fieldTypes[field] === "boolean") {
        out[field] = false;
        claimed.add(field);
        remaining = remaining.replace(new RegExp(escaped, "i"), " ");
      }
      continue;
    }

    const type = fieldTypes[field] ?? "text";
    if (type === "boolean") {
      out[field] = true;
      claimed.add(field);
      remaining = remaining.replace(new RegExp(escaped, "i"), " ");
    } else if (type === "text" && out[field] === undefined) {
      // Standalone feature lines like "Footswitch included"
      if (line.length <= 80) {
        if (/\bincluded\b/i.test(line)) out[field] = "Included";
        else if (line.toLowerCase().trim() === pattern || line.length < pattern.length + 25) {
          out[field] = line.trim();
        }
        if (out[field] !== undefined) {
          claimed.add(field);
          remaining = remaining.replace(new RegExp(escaped, "i"), " ");
        }
      }
    }
  }

  return out;
}

/** Channel control blurbs → accumulate into eqControls. */
function isChannelDescription(label: string): boolean {
  return /\bchannels?\b/i.test(label) && !/^\s*channels?\s*$/i.test(label);
}

function setField(
  result: Record<string, string | number | boolean>,
  field: string,
  value: string | number | boolean,
  mode: "set" | "append" = "set"
): void {
  if (mode === "append" && typeof value === "string") {
    const prev = result[field];
    if (typeof prev === "string" && prev.length > 0) {
      if (prev.includes(value)) return;
      result[field] = `${prev}; ${value}`;
      return;
    }
  }
  // Don't clobber a more specific value with a weaker one.
  if (result[field] !== undefined && mode === "set") {
    // Prefer keeping existing numbers/booleans; allow text upgrade only if empty.
    return;
  }
  result[field] = value;
}

/**
 * Parses spec text copy-pasted from a retailer or manufacturer product page
 * into form field values.
 *
 * Supported shapes (mixed freely):
 * - "Label&lt;tab&gt;Value" (HTML table copy)
 * - "Label: Value"
 * - Free-form feature lists, one item per line ("120W tube power", "Master volume")
 * - Bullet / numbered lists
 */
export function parseSpecText(
  text: string,
  category: CategoryDef
): Record<string, string | number | boolean> {
  const entries = SYNONYMS[category.key] ?? [];

  const fieldTypes: Record<string, SpecFieldType> = {};
  for (const section of category.specSections) {
    for (const f of section.fields) fieldTypes[f.key] = f.type;
  }

  const result: Record<string, string | number | boolean> = {};
  const leftoverNotes: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripListPrefix(rawLine.trim());
    if (!line) continue;

    // --- 1) Tab-separated Label / Value ---
    if (line.includes("\t")) {
      const idx = line.indexOf("\t");
      const label = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      const field = matchField(label, entries);
      if (field && value) {
        const coerced = coerceValue(fieldTypes[field], value);
        if (coerced !== null) setField(result, field, coerced);
        continue;
      }
    }

    // --- 2) Colon-separated Label: Value ---
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0 && colonIdx <= 48) {
      const label = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();

      if (value) {
        // Channel control blurbs (Clean channel: gain, volume, EQ…)
        if (isChannelDescription(label)) {
          setField(result, "eqControls", `${label}: ${value}`, "append");
          // Also try to learn channel count from named channels when missing.
          if (result.channels === undefined && category.key === "amp") {
            // counted later from accumulated eq lines if needed
          }
          continue;
        }

        const field = matchField(label, entries);
        if (field) {
          const coerced = coerceValue(fieldTypes[field], value);
          if (coerced !== null) {
            if (fieldTypes[field] === "text" && result[field] !== undefined) {
              setField(result, field, String(coerced), "append");
            } else {
              setField(result, field, coerced);
            }
            // Still mine the full line for embedded facts ("Power: 120W tube")
            const embedded = extractEmbeddedValues(line, category.key);
            for (const [k, v] of Object.entries(embedded)) {
              setField(result, k, v);
            }
            continue;
          }
        }

        // Unmatched "Something: detail" — keep as a note if it looks useful.
        if (label.length <= 40) leftoverNotes.push(line);
        // Fall through to free-form extraction on the whole line too.
      }
    }

    // --- 3) Free-form: embedded numbers / amp type / etc. ---
    const embedded = extractEmbeddedValues(line, category.key);
    for (const [k, v] of Object.entries(embedded)) {
      setField(result, k, v);
    }

    // --- 4) Free-form: feature phrase mentions ---
    const mentions = extractFeatureMentions(line, entries, fieldTypes);
    for (const [k, v] of Object.entries(mentions)) {
      // Text footswitch: prefer "Included" over dumping the whole line when both fire.
      if (k === "footswitch" && typeof v === "string" && result.footswitch === undefined) {
        setField(result, k, v);
      } else {
        setField(result, k, v);
      }
    }

    // Track free-form leftovers that didn't contribute any field (for notes).
    const contributed =
      Object.keys(embedded).length > 0 ||
      Object.keys(mentions).length > 0 ||
      (colonIdx > 0 && isChannelDescription(line.slice(0, colonIdx)));
    if (!contributed && line.length > 3 && line.length < 120 && colonIdx <= 0) {
      leftoverNotes.push(line);
    }
  }

  // If channel control lines filled eqControls but channels is still empty,
  // count distinct "… channel" labels.
  if (category.key === "amp" && result.channels === undefined && typeof result.eqControls === "string") {
    const names = result.eqControls.match(/\b\w[\w\s/]*\bchannel/gi);
    if (names && names.length >= 2) result.channels = names.length;
  }

  // Unmatched descriptive lines → notes (don't overwrite a user-supplied notes field
  // if we somehow already set one; paste only fills empty notes).
  if (leftoverNotes.length > 0 && result.notes === undefined) {
    // Drop leftovers that are clearly already represented in structured fields.
    const filtered = leftoverNotes.filter((n) => {
      const l = n.toLowerCase();
      if (result.effectsLoop && /effects?\s*loop/.test(l)) return false;
      if (result.masterVolume && /master\s*volume/.test(l)) return false;
      if (result.diOut && /line\s*out|di\s*out/.test(l)) return false;
      if (result.wattage !== undefined && /^\d/.test(l) && /\bw/.test(l)) return false;
      if (result.channels !== undefined && /channel/.test(l) && !l.includes(":")) return false;
      return true;
    });
    if (filtered.length > 0) {
      result.notes = filtered.join("\n");
    }
  }

  return result;
}
