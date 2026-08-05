import type ApplicationInstance from '@ember/application/instance';
import type { VariationOptions } from './adapters/base.ts';

/**
 * Importable `variation()` for use in plain JS modules — routes, utilities,
 * anywhere `@service` injection isn't ergonomic.
 *
 * Three ways to read a flag, pick the right one:
 *  - **Template helper** `{{variation "my-flag"}}` — reactive, re-renders on change.
 *  - **`@service featureFlags`** in components — reactive via tracked getters.
 *  - **This `variation()` function** — NOT reactive. Reads the value at call
 *    time. Use it for one-shot decisions like route redirects, never for
 *    anything that should update when the flag flips.
 *
 * This file works by caching the application owner at boot (see
 * `instance-initializers/feature-flags.ts`), then looking up the service
 * on each call. Without that owner, `variation()` has no way to reach the
 * service from a plain module.
 */

/** Cached at boot by the instance-initializer. */
let cachedOwner: ApplicationInstance | null = null;

/**
 * Called once by `instance-initializers/feature-flags.ts` to give this
 * module a handle on the running app instance. Prefixed with `_` to signal
 * it's internal — consumers should never call this directly.
 */
export function _setOwner(owner: ApplicationInstance): void {
  cachedOwner = owner;
}

/**
 * Read a flag's value from outside a component. Not reactive — see the
 * module-level comment for when to use this vs. the helper or service.
 *
 * @throws if called before the instance-initializer has captured the owner
 *   (i.e. before app boot completes).
 */
export function variation<T = unknown>(
  flagName: string,
  options?: VariationOptions<T>,
): T {
  if (!cachedOwner) throw new Error('feature-flags not initialized');
  const service = cachedOwner.lookup('service:feature-flags');
  return service.variation<T>(flagName, options);
}

// Re-exports so consumers can import everything from one place if they want.
export { default as BaseFeatureFlagAdapter } from './adapters/base.ts';
export type { FlagUser, VariationOptions } from './adapters/base.ts';
