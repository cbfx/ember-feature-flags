import type { FlagUser } from './adapters/base.ts';
import type FeatureFlagsService from './services/feature-flags.ts';
import type { FeatureFlagsConfig, AdapterRegistry } from './services/feature-flags.ts';
import type { DriftReporter } from './drift-reporter.ts';
export declare function _getService(): FeatureFlagsService | null;
export declare function _setService(service: FeatureFlagsService | null): void;
/**
 * Initialize the feature-flag service from outside a component/route.
 * Mirrors `ember-launch-darkly`'s top-level `initialize()` for
 * find-and-replace migration.
 *
 * Consumers can also call `this.featureFlags.initialize(...)` directly if
 * the service is already injected — behavior is identical.
 */
export declare function initialize(config: FeatureFlagsConfig, registry?: AdapterRegistry): Promise<void>;
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
export declare function identify(user: FlagUser, traits?: Record<string, unknown>): Promise<void>;
/**
 * Read a flag's value from outside a component. Not reactive — reads at
 * call time.
 */
export declare function variation<T = unknown>(flagName: string, defaultValue?: T): T | undefined;
export declare function setDriftReporter(reporter: DriftReporter): void;
export { default as BaseFeatureFlagAdapter } from './adapters/base.ts';
export type { FlagUser, VariationOptions } from './adapters/base.ts';
//# sourceMappingURL=variation.d.ts.map