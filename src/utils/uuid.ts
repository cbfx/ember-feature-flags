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
export function randomId(): string {
  const c: Crypto | undefined =
    typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

  if (typeof c?.randomUUID === 'function') {
    return c.randomUUID();
  }

  if (typeof c?.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16));
    // RFC 4122 version 4 layout.
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
      '',
    );
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-');
  }

  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
