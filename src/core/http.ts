// HTTP core for the UF Data SDK: a polite fetch wrapper with a shared User-Agent,
// a request timeout, a minimum delay between requests (rate limiting), and optional
// per-request caching. Every service goes through this so the whole SDK is one
// well-behaved client.

import type { Cache } from "./cache.js";
import { MemoryCache } from "./cache.js";

const DEFAULT_UA = "Mozilla/5.0 (uf-api SDK; +https://github.com/RSCAV/uf-api)";

export interface HttpOptions {
  /** Override the User-Agent sent on every request. */
  userAgent?: string;
  /** Cache implementation (defaults to an in-memory cache). */
  cache?: Cache;
  /** Minimum milliseconds between outbound requests (politeness). Default 250. */
  minDelayMs?: number;
  /** Per-request timeout in milliseconds. Default 20000. */
  timeoutMs?: number;
}

export interface RequestOpts {
  /** If set, cache the response for this many ms (keyed by cacheKey or the URL). */
  ttlMs?: number;
  cacheKey?: string;
  headers?: Record<string, string>;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpError";
  }
}

export class Http {
  readonly cache: Cache;
  private ua: string;
  private minDelay: number;
  private timeout: number;
  private lastAt = 0;

  constructor(o: HttpOptions = {}) {
    this.ua = o.userAgent ?? DEFAULT_UA;
    this.cache = o.cache ?? new MemoryCache();
    this.minDelay = o.minDelayMs ?? 250;
    this.timeout = o.timeoutMs ?? 20_000;
  }

  private async throttle(): Promise<void> {
    const wait = this.lastAt + this.minDelay - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastAt = Date.now();
  }

  private async raw(url: string, init: RequestInit, headers?: Record<string, string>): Promise<Response> {
    await this.throttle();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeout);
    try {
      return await fetch(url, { ...init, signal: ctrl.signal, headers: { "User-Agent": this.ua, ...(headers ?? {}) } });
    } finally {
      clearTimeout(t);
    }
  }

  async getText(url: string, opts: RequestOpts = {}): Promise<string> {
    const key = opts.cacheKey ?? `GET ${url}`;
    if (opts.ttlMs) {
      const cached = await this.cache.get<string>(key);
      if (cached !== undefined) return cached;
    }
    const res = await this.raw(url, { method: "GET" }, opts.headers);
    if (!res.ok) throw new HttpError(res.status, url);
    const text = await res.text();
    if (opts.ttlMs) await this.cache.set(key, text, opts.ttlMs);
    return text;
  }

  async getJson<T>(url: string, opts: RequestOpts = {}): Promise<T> {
    const key = opts.cacheKey ?? `GET ${url}`;
    if (opts.ttlMs) {
      const cached = await this.cache.get<T>(key);
      if (cached !== undefined) return cached;
    }
    const res = await this.raw(url, { method: "GET" }, { Accept: "application/json", ...(opts.headers ?? {}) });
    if (!res.ok) throw new HttpError(res.status, url);
    const json = (await res.json()) as T;
    if (opts.ttlMs) await this.cache.set(key, json, opts.ttlMs);
    return json;
  }

  async postJson<T>(url: string, body: unknown, opts: RequestOpts = {}): Promise<T> {
    const res = await this.raw(
      url,
      { method: "POST", body: JSON.stringify(body) },
      { "Content-Type": "application/json", Accept: "application/json", ...(opts.headers ?? {}) },
    );
    if (!res.ok) throw new HttpError(res.status, url);
    return (await res.json()) as T;
  }
}
