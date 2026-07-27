import { ReadOnlyRateLimitPort } from './rate-limit-port.js';
import { httpInvariant } from './errors.js';

export class InMemoryFixedWindowRateLimiter extends ReadOnlyRateLimitPort {
  constructor(options = {}) {
    super();
    this.limit = options.limit ?? 60;
    this.windowMs = options.windowMs ?? 60_000;
    this.maxEntries = options.maxEntries ?? 10_000;
    this.clock = options.clock ?? (() => Date.now());
    httpInvariant(Number.isSafeInteger(this.limit) && this.limit > 0,
      'INVALID_RATE_LIMIT_CONFIG', 'Rate limit must be a positive integer', 500);
    httpInvariant(Number.isSafeInteger(this.windowMs) && this.windowMs > 0,
      'INVALID_RATE_LIMIT_CONFIG', 'Rate limit windowMs must be a positive integer', 500);
    httpInvariant(Number.isSafeInteger(this.maxEntries) && this.maxEntries > 0,
      'INVALID_RATE_LIMIT_CONFIG', 'Rate limit maxEntries must be a positive integer', 500);
    this.windows = new Map();
  }

  async consume(request) {
    httpInvariant(typeof request?.key === 'string' && request.key.length > 0,
      'INVALID_RATE_LIMIT_KEY', 'Rate limit key must be a non-empty string', 500);
    const now = request.now ?? this.clock();
    httpInvariant(Number.isFinite(now),
      'INVALID_RATE_LIMIT_TIME', 'Rate limit time must be finite', 500);
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    let state = this.windows.get(request.key);
    if (!state || state.windowStart !== windowStart) {
      state = { windowStart, count: 0, touchedAt: now };
    }
    const allowed = state.count < this.limit;
    if (allowed) state.count += 1;
    state.touchedAt = now;
    this.windows.set(request.key, state);
    this.evictIfNeeded();
    return {
      allowed,
      limit: this.limit,
      remaining: Math.max(0, this.limit - state.count),
      resetAt: windowStart + this.windowMs,
    };
  }

  evictIfNeeded() {
    if (this.windows.size <= this.maxEntries) return;
    const oldest = [...this.windows.entries()]
      .sort((left, right) => left[1].touchedAt - right[1].touchedAt)
      .slice(0, this.windows.size - this.maxEntries);
    for (const [key] of oldest) this.windows.delete(key);
  }
}
