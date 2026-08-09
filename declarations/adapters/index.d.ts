import type { AdapterRegistry } from '../services/feature-flags';
/**
 * The default registry of adapter loaders shipped with the addon. Consumers
 * pass this to `featureFlags.initialize()`, optionally spread with their own
 * custom adapters:
 *
 *   await this.featureFlags.initialize(config.APP.featureFlags);
 *
 * Each entry is a lazy loader — the underlying SDK is only bundled when
 * that provider is actually registered and used.
 */
export declare const defaultAdapters: AdapterRegistry;
export { default as BaseFeatureFlagAdapter } from './base.ts';
export { default as LaunchDarklyAdapter } from './launch-darkly.ts';
export { default as AppConfigAdapter } from './app-config.ts';
export { default as TestFeatureFlagAdapter } from './test.ts';
//# sourceMappingURL=index.d.ts.map