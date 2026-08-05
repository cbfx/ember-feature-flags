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
export const defaultAdapters: AdapterRegistry = {
  'launch-darkly': async () => (await import('./launch-darkly.ts')).default,
  'app-config': async () => (await import('./app-config.ts')).default,
  test: async () => (await import('./test.ts')).default,
};

// Re-export adapter default classes so consumers can import them directly.
export { default as BaseFeatureFlagAdapter } from './base.ts';
export { default as LaunchDarklyAdapter } from './launch-darkly.ts';
export { default as AppConfigAdapter } from './app-config.ts';
export { default as TestFeatureFlagAdapter } from './test.ts';
