import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import {
  defaultLookup,
  normalizeHostname,
  parseHttpUrl,
  resolvePublicAddresses,
  type LookupFn,
  type ResolvedAddress,
} from "@/lib/safeDestination";

export { assertSafeUrl } from "@/lib/safeDestination";

const MAX_REDIRECTS = 5;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function mergeCookies(existing: string | undefined, setCookieHeaders: string[]): string {
  const jar = new Map<string, string>();
  if (existing) {
    for (const part of existing.split(/;\s*/)) {
      const eq = part.indexOf("=");
      if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
    }
  }
  for (const header of setCookieHeaders) {
    const first = header.split(";")[0]?.trim();
    if (!first) continue;
    const eq = first.indexOf("=");
    if (eq > 0) jar.set(first.slice(0, eq), first.slice(eq + 1));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function getSetCookieHeaders(headers: Headers): string[] {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function nodeHeadersToHeaders(raw: http.IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (key === "set-cookie") {
      const list = Array.isArray(value) ? value : [value];
      for (const cookie of list) headers.append("set-cookie", cookie);
    } else if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

export type HopResponse = {
  status: number;
  headers: Headers;
  body: Buffer;
};

export type TransportRequest = {
  url: URL;
  addresses: ResolvedAddress[];
  headers: Record<string, string>;
  signal: AbortSignal;
  maxBytes: number;
};

export type TransportFn = (request: TransportRequest) => Promise<HopResponse>;

export async function defaultTransport(request: TransportRequest): Promise<HopResponse> {
  const addr = request.addresses[0];
  if (!addr) {
    throw new Error("Could not reach that URL");
  }

  const { url, headers, signal, maxBytes } = request;
  const lib = url.protocol === "https:" ? https : http;
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  const path = `${url.pathname}${url.search}` || "/";

  const reqOptions: https.RequestOptions = {
    protocol: url.protocol,
    hostname: addr.address,
    port,
    method: "GET",
    path,
    headers: { ...headers, Host: url.host },
    signal,
    setHost: false,
  };
  const sni = normalizeHostname(url.hostname);
  if (url.protocol === "https:" && !isIP(sni)) {
    reqOptions.servername = sni;
  }

  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error("Could not reach that URL"));
    const req = lib.request(reqOptions, (res) => {
      const status = res.statusCode || 0;
      const hopHeaders = nodeHeadersToHeaders(res.headers);
      if (status >= 300 && status < 400) {
        res.resume();
        resolve({ status, headers: hopHeaders, body: Buffer.alloc(0) });
        return;
      }
      const declared = Number(res.headers["content-length"] || 0);
      if (declared > maxBytes) {
        res.destroy();
        reject(new Error("Remote response is too large"));
        return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      res.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) {
          res.destroy();
          reject(new Error("Remote response is too large"));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        resolve({ status, headers: hopHeaders, body: Buffer.concat(chunks) });
      });
      res.on("error", fail);
    });
    req.on("error", fail);
    req.end();
  });
}

export interface SafeFetchResult {
  headers: Headers;
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
  lookup?: LookupFn;
  transport?: TransportFn;
}

/**
 * Fetch a remote URL after resolving and rejecting non-public destinations.
 * Redirects are followed manually so every hop is re-checked. Connections are
 * pinned to the addresses that already passed the policy (no second DNS lookup
 * at connect time). Caps response body size and carries cookies across hops.
 */
export async function safeFetch(
  sourceUrl: string,
  options: SafeFetchOptions
): Promise<SafeFetchResult> {
  let current = parseHttpUrl(sourceUrl);
  let hopResponse: HopResponse | null = null;
  const timeoutMs = options.timeoutMs ?? 15000;
  const userAgent = options.userAgent ?? BROWSER_UA;
  const lookup = options.lookup ?? defaultLookup;
  const transport = options.transport ?? defaultTransport;
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
    const addresses = await resolvePublicAddresses(current, lookup);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers: Record<string, string> = { ...baseHeaders };
    if (cookie) headers.Cookie = cookie;
    if (hop > 0) {
      headers["Sec-Fetch-Site"] = "same-origin";
      headers["Sec-Fetch-Mode"] = "navigate";
      headers["Referer"] = current.origin + "/";
    }

    try {
      hopResponse = await transport({
        url: current,
        addresses,
        headers,
        signal: controller.signal,
        maxBytes: options.maxBytes,
      });
    } catch (err) {
      if (err instanceof Error && err.message === "Remote response is too large") {
        throw err;
      }
      throw new Error("Could not reach that URL");
    } finally {
      clearTimeout(timeout);
    }

    cookie = mergeCookies(cookie, getSetCookieHeaders(hopResponse.headers));

    if (hopResponse.status >= 300 && hopResponse.status < 400) {
      const location = hopResponse.headers.get("location");
      if (!location) {
        throw new Error("That URL returned a redirect without a destination");
      }
      current = parseHttpUrl(new URL(location, current).toString());
      continue;
    }
    break;
  }

  if (!hopResponse) {
    throw new Error("Could not reach that URL");
  }
  if (hopResponse.status >= 300 && hopResponse.status < 400) {
    throw new Error("Too many redirects");
  }
  if (hopResponse.status >= 400 && !options.allowHttpErrors) {
    throw new Error(httpErrorMessage(hopResponse.status));
  }

  return {
    headers: hopResponse.headers,
    finalUrl: current,
    body: hopResponse.body,
    status: hopResponse.status,
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
    (/captcha/.test(sample) && /blocked|denied|access|verify/.test(sample))
  );
}
