import { warn } from '@ember/debug';
import type { FlagUser } from './adapters/base.ts';
import type FeatureFlagsService from './services/feature-flags.ts';
import type {
  FeatureFlagsConfig,
  AdapterRegistry,
  FeatureFlagsOptions,
} from './services/feature-flags.ts';

/**
 * Importable API for use in plain JS modules — routes, utilities, anywhere
 * `@service` injection isn't ergonomic.
 *
 * These functions look up the service via the owner captured at boot (see
 * `instance-initializers/feature-flags.ts`). Reactivity is limited: for a
 * reactive flag read use the template helper `{{variation}}` or inject the
 * service directly.
 */

let currentService: FeatureFlagsService | null = null;

export function _getService(): FeatureFlagsService | null {
  return currentService;
}

export function _setService(service: FeatureFlagsService | null): void {
  currentService = service;
}

function getService(): FeatureFlagsService {
  if (!currentService) throw new Error('feature-flags not initialized');
  return currentService;
}

/**
 * Initialize the feature-flag service from outside a component/route.
 * Mirrors `ember-launch-darkly`'s top-level `initialize()` for
 * find-and-replace migration.
 *
 * Consumers can also call `this.featureFlags.initialize(...)` directly if
 * the service is already injected — behavior is identical.
 */
export async function initialize(
  config: FeatureFlagsConfig,
  registry?: AdapterRegistry,
  options?: FeatureFlagsOptions,
): Promise<void> {
  // Parity with ELD: `initialize()` early-returns when a context already
  // exists, so a test's setup survives the app booting under `visit()`.
  if (currentService?.primary) return;
  await getService().initialize(config, registry, options);
}

/**
 * Swap the anonymous user for the real one, from outside a component. Fans out
 * to the primary and every healthy secondary in parallel.
 *
 * `user.id` is mapped to each provider's own identifier by its adapter — LD's
 * context `key`, App Configuration's entity id — so callers pass one shape
 * regardless of provider. `traits` are merged in as extra targeting
 * attributes.
 *
 * Call this once you know who the user is; every flag read after it is
 * evaluated against that identity.
 */
export async function identify(
  user: FlagUser,
  traits: Record<string, unknown> = {},
): Promise<void> {
  await getService().identify(user, traits);
}

/**
 * Read a flag's value from outside a component. Not reactive — reads at
 * call time.
 */
export function variation<T = unknown>(
  flagName: string,
  defaultValue?: T,
): T | undefined {
  if (!currentService) {
    warn(
      `Feature flags have not been initialized. Returning default value for "${flagName}".`,
      false,
      { id: 'ember-feature-flags.variation.not-initialized' },
    );
    return defaultValue;
  }
  return currentService.variation<T>(flagName, { defaultValue });
}

// Re-exports so consumers can import everything from one place if they want.
export { default as BaseFeatureFlagAdapter } from './adapters/base.ts';
export type { FlagUser, VariationOptions } from './adapters/base.ts';
