const MAX_REDIRECTS = 5;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0" || h === "::1" || h.endsWith(".local")) return true;
  if (h === "[::1]" || h.startsWith("[fc") || h.startsWith("[fd") || h.startsWith("[fe80")) {
    return true;
  }

  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 0 || a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a >= 224) return true;
  }
  return false;
}

export function assertSafeUrl(sourceUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error("That doesn't look like a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http/https URLs are supported");
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new Error("That URL points to a restricted address");
  }
  return parsed;
}

function mergeCookies(existing: string | undefined, setCookieHeaders: string[]): string {
  const jar = new Map<string, string>();
  if (existing) {
    for (const part of existing.split(/;\s*/)) {
      const eq = part.indexOf("=");
      if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
    }
  }
  for (const header of setCookieHeaders) {
    // "name=value; Path=/; HttpOnly" → name=value
    const first = header.split(";")[0]?.trim();
    if (!first) continue;
    const eq = first.indexOf("=");
    if (eq > 0) jar.set(first.slice(0, eq), first.slice(eq + 1));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function getSetCookieHeaders(response: Response): string[] {
  // Node/undici supports getSetCookie(); fall back to single header.
  const anyHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

export interface SafeFetchResult {
  response: Response;
  finalUrl: URL;
  body: Buffer;
  status: number;
}

export interface SafeFetchOptions {
  maxBytes: number;
  timeoutMs?: number;
  accept?: string;
  userAgent?: string;
  /** Extra headers merged on top of browser-like defaults. */
  headers?: Record<string, string>;
  /**
   * When true, HTTP error statuses still return body instead of throwing.
   * Network failures and oversized bodies still throw.
   */
  allowHttpErrors?: boolean;
  /** Prefer a full browser-like header set (for HTML product pages). */
  browserLike?: boolean;
}

/**
 * Fetch a remote URL with private-host blocking and manual redirect walking
 * so each hop is re-checked. Caps response body size. Carries cookies across
 * redirects so sites that set a session cookie mid-redirect still work.
 */
export async function safeFetch(
  sourceUrl: string,
  options: SafeFetchOptions
): Promise<SafeFetchResult> {
  let current = assertSafeUrl(sourceUrl);
  let response: Response | null = null;
  const timeoutMs = options.timeoutMs ?? 15000;
  const userAgent = options.userAgent ?? BROWSER_UA;
  let cookie = "";

  const baseHeaders: Record<string, string> = options.browserLike
    ? {
        "User-Agent": userAgent,
        Accept:
          options.accept ??
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"macOS"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      }
    : {
        "User-Agent": userAgent,
        Accept: options.accept ?? "*/*",
      };

  if (options.headers) {
    Object.assign(baseHeaders, options.headers);
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers: Record<string, string> = { ...baseHeaders };
    if (cookie) headers.Cookie = cookie;
    // After the first hop, this is a redirect follow from the previous host.
    if (hop > 0) {
      headers["Sec-Fetch-Site"] = "same-origin";
      headers["Sec-Fetch-Mode"] = "navigate";
      headers["Referer"] = current.origin + "/";
    }

    try {
      response = await fetch(current, {
        signal: controller.signal,
        redirect: "manual",
        headers,
      });
    } catch {
      throw new Error("Could not reach that URL");
    } finally {
      clearTimeout(timeout);
    }

    cookie = mergeCookies(cookie, getSetCookieHeaders(response));

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("That URL returned a redirect without a destination");
      }
      current = assertSafeUrl(new URL(location, current).toString());
      continue;
    }
    break;
  }

  if (!response) {
    throw new Error("Could not reach that URL");
  }
  if (response.status >= 300 && response.status < 400) {
    throw new Error("Too many redirects");
  }
  if (!response.ok && !options.allowHttpErrors) {
    throw new Error(httpErrorMessage(response.status));
  }

  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > options.maxBytes) {
    throw new Error("Remote response is too large");
  }

  if (!response.body) {
    if (!response.ok && options.allowHttpErrors) {
      return { response, finalUrl: current, body: Buffer.alloc(0), status: response.status };
    }
    throw new Error("That URL returned an empty response");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > options.maxBytes) {
        await reader.cancel();
        throw new Error("Remote response is too large");
      }
      chunks.push(value);
    }
  }

  return {
    response,
    finalUrl: current,
    body: Buffer.concat(chunks),
    status: response.status,
  };
}

export function httpErrorMessage(status: number): string {
  if (status === 403 || status === 401) {
    return (
      `That site blocked automated access (HTTP ${status}). ` +
      `Open the page in your browser, copy the product title and specs, and paste them into “Look up specs” below.`
    );
  }
  if (status === 404) {
    return "That URL was not found (404). Check the link and try again.";
  }
  if (status === 429) {
    return "That site rate-limited the request. Wait a moment and try again, or paste the specs manually.";
  }
  return `That URL returned an error (HTTP ${status}).`;
}

/** Heuristic: response is a bot-wall / captcha interstitial rather than a product page. */
export function looksLikeBotWall(status: number, bodyText: string): boolean {
  if (status === 401 || status === 403 || status === 429) return true;
  const sample = bodyText.slice(0, 8000).toLowerCase();
  if (!sample) return status >= 400;
  return (
    sample.includes("px-captcha") ||
    sample.includes("access to this page has been denied") ||
    sample.includes("cf-browser-verification") ||
    sample.includes("cf-challenge") ||
    sample.includes("challenge-platform") ||
    sample.includes("just a moment...") ||
    sample.includes("attention required") ||
    sample.includes("enable javascript and cookies") ||
    sample.includes("checking your browser") ||
    sample.includes("verify you are human") ||
    sample.includes("bot detection") ||
    sample.includes("datadome") ||
    sample.includes("perimeterx") ||
    /captcha/.test(sample) && /blocked|denied|access|verify/.test(sample)
  );
}
