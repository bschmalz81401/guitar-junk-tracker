"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import CollapsibleSection from "./CollapsibleSection";
import { ITEM_STATUSES, type CategoryDef } from "@/types/categories";
import { parseSpecText } from "@/lib/specParser";
import Field from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

export interface ItemFormValues {
  id?: number;
  name: string;
  brand: string;
  model: string;
  series: string;
  finishColor: string;
  dateAcquired: string;
  acquisitionSource: string;
  pricePaid: string;
  pricePaidPublic: boolean;
  serialNumber: string;
  serialNumberPublic: boolean;
  status: string;
  notes: string;
  [specKey: string]: string | number | boolean | undefined;
}

const EMPTY_VALUES: ItemFormValues = {
  name: "",
  brand: "",
  model: "",
  series: "",
  finishColor: "",
  dateAcquired: "",
  acquisitionSource: "",
  pricePaid: "",
  pricePaidPublic: false,
  serialNumber: "",
  serialNumberPublic: false,
  status: "owned",
  notes: "",
};

export default function ItemForm({
  category,
  initialValues,
}: {
  category: CategoryDef;
  initialValues?: Partial<ItemFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ItemFormValues>({
    ...EMPTY_VALUES,
    ...initialValues,
  });
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [productUrl, setProductUrl] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlMessage, setUrlMessage] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  /** Server fetch was blocked — use Brave (or any browser) to capture page content. */
  const [browserCapture, setBrowserCapture] = useState(false);
  const [captureText, setCaptureText] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [parseMessage, setParseMessage] = useState<string | null>(null);
  const [sectionsVersion, setSectionsVersion] = useState(0);
  const isEdit = Boolean(values.id);

  function set(key: string, value: string | number | boolean) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function applyFields(matched: Record<string, string | number | boolean>) {
    setValues((v) => ({ ...v, ...matched }));
    setSectionsVersion((n) => n + 1);
  }

  function applyLookupResult(body: {
    fields?: Record<string, string | number | boolean>;
    fieldCount?: number;
    sourceHost?: string;
  }) {
    const fields = (body?.fields ?? {}) as Record<string, string | number | boolean>;
    const keys = Object.keys(fields);
    if (keys.length === 0) {
      setUrlError("Couldn't extract any fields from that page.");
      return false;
    }
    applyFields(fields);
    const host = typeof body?.sourceHost === "string" ? body.sourceHost : "that page";
    const n = body.fieldCount ?? keys.length;
    setUrlMessage(
      `Filled ${n} field${n === 1 ? "" : "s"} from ${host} — review before saving.`
    );
    setUrlError(null);
    setBrowserCapture(false);
    return true;
  }

  const searchQuery = [values.brand, values.model, category.label, "specs"]
    .filter(Boolean)
    .join(" ");
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

  function enterBrowserCapture(url: string, reason?: string) {
    setBrowserCapture(true);
    setUrlError(reason || null);
    setUrlMessage(
      "This store blocks our server (bot protection). Your browser can still read it — follow the steps below."
    );
    // Open the product page so the user can copy from Brave with a single click.
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      /* popup blocked — they can open the link manually */
    }
  }

  async function handleLookupUrl() {
    const url = productUrl.trim();
    if (!url) return;

    setUrlLoading(true);
    setUrlError(null);
    setUrlMessage(null);
    setBrowserCapture(false);

    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, category: category.key }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (body?.blocked) {
          enterBrowserCapture(url, body?.error);
          return;
        }
        setUrlError(body?.error || `Lookup failed (HTTP ${res.status}).`);
        // Still offer browser capture as a fallback for any fetch failure.
        setBrowserCapture(true);
        return;
      }
      applyLookupResult(body);
    } catch {
      setUrlError("Couldn't reach the server.");
    } finally {
      setUrlLoading(false);
    }
  }

  async function submitBrowserCapture(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      setUrlError("Paste the product page content first (select all → copy → paste here).");
      return;
    }

    setUrlLoading(true);
    setUrlError(null);

    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: productUrl.trim() || undefined,
          text: trimmed,
          category: category.key,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setUrlError(body?.error || `Lookup failed (HTTP ${res.status}).`);
        return;
      }
      applyLookupResult(body);
      setCaptureText("");
    } catch {
      setUrlError("Couldn't reach the server.");
    } finally {
      setUrlLoading(false);
    }
  }

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setUrlError("Clipboard is empty — copy the product page first (⌘A then ⌘C).");
        return;
      }
      setCaptureText(text);
      await submitBrowserCapture(text);
    } catch {
      setUrlError(
        "Couldn't read the clipboard automatically. Paste into the box below (⌘V), then click Parse pasted page."
      );
    }
  }

  function handleParsePaste() {
    const matched = parseSpecText(pasteText, category);
    const keys = Object.keys(matched);
    if (keys.length === 0) {
      setParseMessage("Couldn't find any recognizable spec fields in that text.");
      return;
    }
    applyFields(matched);
    setParseMessage(
      `Filled ${keys.length} field${keys.length === 1 ? "" : "s"} from the pasted text — review before saving.`
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSaveError(null);

    const url = isEdit ? `/api/items/${values.id}` : "/api/items";
    const method = isEdit ? "PUT" : "POST";

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, category: category.key }),
      });
    } catch {
      setSubmitting(false);
      setSaveError("Couldn't reach the server. Is it running?");
      return;
    }

    setSubmitting(false);

    if (!res.ok) {
      if (res.status === 401) {
        setSaveError("Your session has expired — log in again to save.");
      } else {
        const body = await res.json().catch(() => null);
        setSaveError(body?.error || `Save failed (HTTP ${res.status}).`);
      }
      return;
    }

    const item = await res.json();
    router.push(`/${category.slug}/${item.id}`);
    router.refresh();
  }

  const filledSections = category.specSections.filter((section) =>
    section.fields.some(
      (f) => values[f.key] !== undefined && values[f.key] !== "" && values[f.key] !== false
    )
  ).length;
  const basicsReady = Boolean(values.name && values.brand && values.model);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-24">
      {/* Section progress */}
      <div
        className="card p-3 flex flex-wrap gap-2 items-center text-xs"
        aria-label="Form progress"
      >
        <span className="text-[var(--muted)]">Progress:</span>
        <span
          className={`rounded-full px-2.5 py-1 ${
            basicsReady
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-[var(--surface-hover)] text-[var(--muted)]"
          }`}
        >
          1. Basics {basicsReady ? "✓" : ""}
        </span>
        <span className="text-[var(--muted)]">→</span>
        <span
          className={`rounded-full px-2.5 py-1 ${
            filledSections > 0
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-[var(--surface-hover)] text-[var(--muted)]"
          }`}
        >
          2. Specs ({filledSections}/{category.specSections.length})
        </span>
        <span className="text-[var(--muted)]">→</span>
        <span className="rounded-full px-2.5 py-1 bg-[var(--surface-hover)] text-[var(--muted)]">
          3. Save
        </span>
      </div>

      {!isEdit && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-[var(--accent)] mb-1">
            Import from product URL
          </h2>
          <p className="text-xs text-[var(--muted)] mb-3">
            Paste a manufacturer or retailer product page. Sites that allow server access
            fill automatically. Stores like Sweetwater and Guitar Center block bots — for
            those we open the page in your browser and you paste the content back (one
            extra step, works every time).
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={productUrl}
              onChange={(e) => {
                setProductUrl(e.target.value);
                setBrowserCapture(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleLookupUrl();
                }
              }}
              placeholder="https://…"
              className="flex-1"
              disabled={urlLoading}
            />
            <Button
              type="button"
              onClick={() => void handleLookupUrl()}
              disabled={urlLoading || !productUrl.trim()}
              className="shrink-0"
            >
              {urlLoading ? "Working…" : "Fill from URL"}
            </Button>
          </div>

          {browserCapture && (
            <div className="mt-4 rounded-lg border border-[var(--accent)]/40 bg-[var(--surface-hover)] p-3 space-y-3">
              <p className="text-sm font-medium text-[var(--accent)]">
                Browser import (for blocked stores)
              </p>
              <ol className="text-xs text-[var(--muted)] list-decimal list-inside space-y-1">
                <li>
                  Product page opened in a new tab
                  {productUrl.trim() && (
                    <>
                      {" "}
                      (
                      <a
                        href={productUrl.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--accent)] hover:underline"
                      >
                        reopen ↗
                      </a>
                      )
                    </>
                  )}
                </li>
                <li>
                  Best: select just the product title + specs (or the main content
                  area). Full-page copy works too — we strip nav chrome.
                </li>
                <li>
                  Copy (<kbd className="text-[var(--foreground)]">⌘C</kbd>), come back,
                  then paste from clipboard or into the box
                </li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => void handlePasteFromClipboard()}
                  disabled={urlLoading}
                >
                  {urlLoading ? "Parsing…" : "Paste from clipboard & fill"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (productUrl.trim())
                      window.open(productUrl.trim(), "_blank", "noopener,noreferrer");
                  }}
                >
                  Open page again
                </Button>
              </div>
              <textarea
                value={captureText}
                onChange={(e) => setCaptureText(e.target.value)}
                onPaste={(e) => {
                  // Auto-parse when user pastes into the capture box.
                  const pasted = e.clipboardData.getData("text");
                  if (pasted.trim().length > 40) {
                    e.preventDefault();
                    setCaptureText(pasted);
                    void submitBrowserCapture(pasted);
                  }
                }}
                placeholder="Or paste the product page text here…"
                rows={4}
                className="w-full"
                disabled={urlLoading}
              />
              {captureText.trim() && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void submitBrowserCapture(captureText)}
                  disabled={urlLoading}
                >
                  Parse pasted page
                </Button>
              )}
            </div>
          )}

          <Alert className="mt-2">{urlError}</Alert>
          <Alert variant="info" className="mt-2">
            {urlMessage}
          </Alert>
        </div>
      )}

      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Name" required>
          <input value={values.name} onChange={(e) => set("name", e.target.value)} required />
        </Field>
        <Field label="Status">
          <select value={values.status} onChange={(e) => set("status", e.target.value)}>
            {ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Brand" required>
          <input value={values.brand} onChange={(e) => set("brand", e.target.value)} required />
        </Field>
        <Field label="Model" required>
          <input value={values.model} onChange={(e) => set("model", e.target.value)} required />
        </Field>
        <Field label="Series">
          <input value={values.series} onChange={(e) => set("series", e.target.value)} />
        </Field>
        <Field label={category.finishLabel}>
          <input
            value={values.finishColor}
            onChange={(e) => set("finishColor", e.target.value)}
          />
        </Field>
        <Field label="Date Acquired">
          <input
            type="date"
            value={values.dateAcquired}
            onChange={(e) => set("dateAcquired", e.target.value)}
          />
        </Field>
        <Field label="Acquisition Source">
          <input
            value={values.acquisitionSource}
            onChange={(e) => set("acquisitionSource", e.target.value)}
          />
        </Field>
        <Field label="Price Paid">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={values.pricePaid}
            onChange={(e) => set("pricePaid", e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm self-end pb-2">
          <input
            type="checkbox"
            checked={Boolean(values.pricePaidPublic)}
            onChange={(e) => set("pricePaidPublic", e.target.checked)}
            className="w-auto"
          />
          <span>
            Show price on public catalog
            <span className="block text-xs text-[var(--muted)]">Private by default</span>
          </span>
        </label>
        <Field label="Serial Number">
          <input
            value={values.serialNumber}
            onChange={(e) => set("serialNumber", e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm self-end pb-2">
          <input
            type="checkbox"
            checked={Boolean(values.serialNumberPublic)}
            onChange={(e) => set("serialNumberPublic", e.target.checked)}
            className="w-auto"
          />
          <span>
            Show serial on public catalog
            <span className="block text-xs text-[var(--muted)]">Private by default</span>
          </span>
        </label>
        <Field label="Notes" className="sm:col-span-2">
          <textarea
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={4}
            className="w-full"
          />
        </Field>
      </div>

      <div className="card p-4">
        <h2 className="text-sm font-semibold text-[var(--accent)] mb-1">Look up specs</h2>
        <p className="text-xs text-[var(--muted)] mb-3">
          Search for this {category.label.toLowerCase()}, then paste a spec table,{" "}
          <span className="text-[var(--foreground)]">Label: value</span> lines, or a free-form
          feature list — recognized fields auto-fill the sections underneath.
        </p>
        <a
          href={googleSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center min-h-11 mb-3 rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-hover)] cursor-pointer transition-colors duration-150"
        >
          Search Google for &ldquo;{searchQuery}&rdquo; ↗
        </a>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={"Paste specs here — e.g.\n120W tube power\n3 channels\nMaster volume\nEffects loop\nor Label: value / table rows"}
          rows={5}
          className="w-full"
        />
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <Button type="button" onClick={handleParsePaste}>
            Auto-fill from pasted text
          </Button>
          <Alert variant="info">{parseMessage}</Alert>
        </div>
      </div>

      {category.specSections.map((section) => {
        const hasValue = section.fields.some(
          (f) => values[f.key] !== undefined && values[f.key] !== "" && values[f.key] !== false
        );
        return (
          <CollapsibleSection
            key={`${section.title}-${sectionsVersion}`}
            title={section.title}
            defaultOpen={hasValue}
          >
            {section.fields.map((f) =>
              f.type === "boolean" ? (
                <label key={f.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(values[f.key])}
                    onChange={(e) => set(f.key, e.target.checked)}
                    className="w-auto"
                  />
                  {f.label}
                </label>
              ) : (
                <Field key={f.key} label={f.label}>
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    inputMode={f.type === "number" ? "decimal" : undefined}
                    step={f.type === "number" ? "any" : undefined}
                    value={(values[f.key] as string | number | undefined) ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                </Field>
              )
            )}
          </CollapsibleSection>
        );
      })}

      {/* Sticky save bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <Alert className="text-sm">{saveError}</Alert>
          <Button type="submit" size="lg" disabled={submitting} className="ml-auto">
            {submitting ? "Saving..." : isEdit ? "Save Changes" : `Add ${category.label}`}
          </Button>
        </div>
      </div>
    </form>
  );
}
