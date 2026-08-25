/**
 * `crypto.randomUUID()` is only defined in secure contexts. Any developer
 * hitting a dev server over plain `http://` on a LAN IP (or an older browser)
 * gets `undefined`, and calling it throws — which, because both provider
 * adapters generate an anonymous id during construction, took down flag
 * initialization entirely rather than degrading.
 *
 * Falls back to `crypto.getRandomValues` and finally to `Math.random`. The
 * value only needs to be unique per anonymous session, not cryptographically
 * strong: it's a bucketing key for percentage rollouts.
 */
export declare function randomId(): string;
//# sourceMappingURL=uuid.d.ts.map