import { assertSafeUrl, httpErrorMessage, looksLikeBotWall, safeFetch } from "@/lib/safeFetch";
import { fieldsFromMarkdown } from "@/lib/lookup/paste";

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_FALLBACK_BYTES = 1.5 * 1024 * 1024;

export interface FetchedPage {
  html: string;
  text: string | null;
  finalUrl: URL;
  source: "direct" | "jina";
}

export async function fetchProductPage(sourceUrl: string): Promise<FetchedPage> {
  const target = assertSafeUrl(sourceUrl);
  let lastBlockMessage: string | null = null;

  // --- 1) Direct browser-like fetch ---
  try {
    const result = await safeFetch(target.toString(), {
      maxBytes: MAX_HTML_BYTES,
      timeoutMs: 20000,
      browserLike: true,
      allowHttpErrors: true,
    });
    const html = result.body.toString("utf8");
    if (!looksLikeBotWall(result.status, html) && html.trim().length > 200) {
      const contentType = (result.headers.get("content-type") || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (
        !contentType ||
        contentType.includes("html") ||
        contentType.includes("xml") ||
        contentType.includes("text/")
      ) {
        return { html, text: null, finalUrl: result.finalUrl, source: "direct" };
      }
    }
    if (result.status >= 400) {
      lastBlockMessage = httpErrorMessage(result.status);
    } else {
      lastBlockMessage =
        "That site served a bot-check page instead of the product listing.";
    }
  } catch (err) {
    lastBlockMessage = err instanceof Error ? err.message : "Could not reach that URL";
  }

  // --- 2) Jina Reader (markdown) — bypasses some soft WAF blocks ---
  try {
    const jinaUrl = `https://r.jina.ai/${target.toString()}`;
    const result = await safeFetch(jinaUrl, {
      maxBytes: MAX_FALLBACK_BYTES,
      timeoutMs: 45000,
      browserLike: true,
      allowHttpErrors: true,
      headers: {
        Accept: "text/plain,text/markdown,text/html,*/*",
        "X-Return-Format": "markdown",
        // Jina is a different origin; don't claim Sec-Fetch-Site: none.
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
      },
    });
    const raw = result.body.toString("utf8");
    if (
      result.status < 400 &&
      raw.trim().length > 100 &&
      !looksLikeBotWall(result.status, raw) &&
      !/target url returned error 403/i.test(raw) &&
      !/access to this page has been denied/i.test(raw)
    ) {
      const { title, body } = fieldsFromMarkdown(raw);
      // Synthesize a minimal HTML shell so JSON-LD/meta extractors no-op gracefully
      // and title still flows through cleanProductTitle path.
      const html = title
        ? `<html><head><title>${title.replace(/</g, "")}</title><meta property="og:title" content="${title.replace(/"/g, "&quot;")}" /></head><body></body></html>`
        : "<html><body></body></html>";
      return {
        html,
        text: [title, body].filter(Boolean).join("\n\n"),
        finalUrl: target,
        source: "jina",
      };
    }
  } catch {
    // keep lastBlockMessage from direct attempt
  }

  throw new Error(
    lastBlockMessage ||
      "Couldn't fetch that product page. Open it in your browser, copy the specs, and paste them below."
  );
}
