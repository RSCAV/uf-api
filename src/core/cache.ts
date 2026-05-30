// Pluggable cache for the UF Data SDK. The catalog changes slowly, so caching is the
// contract that keeps us a respectful consumer of UF's unofficial public endpoints.

export interface Cache {
  get<T>(key: string): Promise<T | undefined> | T | undefined;
  set<T>(key: string, value: T, ttlMs?: number): Promise<void> | void;
}

interface Entry {
  value: unknown;
  expiresAt: number; // 0 = never expires
}

/** In-memory cache with per-entry TTL. Default for `createClient()`. */
export class MemoryCache implements Cache {
  private store = new Map<string, Entry>();

  get<T>(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt && hit.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  set<T>(key: string, value: T, ttlMs = 0): void {
    this.store.set(key, { value, expiresAt: ttlMs ? Date.now() + ttlMs : 0 });
  }

  clear(): void {
    this.store.clear();
  }
}

/** TTL presets, chosen by data volatility. */
export const TTL = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
} as const;
