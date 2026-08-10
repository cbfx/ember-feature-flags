import type { AdapterRegistry } from '../services/feature-flags.ts';
/**
 * The registry of adapters that are always safe to load.
 *
 * Only `test` lives here, because it's the only built-in adapter with no
 * third-party SDK behind it. Provider adapters are **opt-in via their own
 * subpath export** — see below for why that matters.
 *
 *   import { defaultAdapters } from 'ember-feature-flags/adapters';
 *   import LaunchDarklyAdapter from 'ember-feature-flags/adapters/launch-darkly';
 *
 *   await this.featureFlags.initialize(config.APP.featureFlags, {
 *     ...defaultAdapters,
 *     'launch-darkly': async () => LaunchDarklyAdapter,
 *   });
 *
 * ## Why provider adapters aren't in here
 *
 * `ibm-appconfiguration-js-client-sdk` and `ember-launch-darkly` are optional
 * peer dependencies — consumers who use LaunchDarkly shouldn't have to install
 * IBM's SDK, and vice versa. But "optional" only holds if nothing in the
 * module graph references them, and a bundler does not care whether an import
 * is static or dynamic. A dynamic import of the app-config module still puts
 * that module in the graph, which still puts `ibm-appconfiguration-js-client-sdk`
 * in the graph. Vite's dependency scanner then tries to pre-bundle an SDK that
 * isn't installed and the build dies before a line of app code runs.
 *
 * Lazy loaders control *when code executes*, never *what the bundler must
 * resolve*. The only thing that keeps an uninstalled optional peer out of the
 * graph is the consumer not importing the module that needs it — hence the
 * separate entry points.
 */
export declare const defaultAdapters: AdapterRegistry;
/**
 * Base class for custom adapters. Safe to re-export here — it has no
 * third-party imports of its own.
 */
export { default as BaseFeatureFlagAdapter } from './base.ts';
export { default as TestFeatureFlagAdapter } from './test.ts';
export type { FlagUser, VariationOptions, ChangeCallback, Unsubscribe, } from './base.ts';
//# sourceMappingURL=index.d.ts.map