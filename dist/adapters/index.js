export { default as BaseFeatureFlagAdapter } from './base.js';
export { default as LaunchDarklyAdapter } from './launch-darkly.js';
export { default as AppConfigAdapter } from './app-config.js';
export { default as TestFeatureFlagAdapter } from './test.js';

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
const defaultAdapters = {
  'launch-darkly': async () => (await import('./launch-darkly.js')).default,
  'app-config': async () => (await import('./app-config.js')).default,
  test: async () => (await import('./test.js')).default
};

export { defaultAdapters };
//# sourceMappingURL=index.js.map
