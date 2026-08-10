/**
 * Public entry point for `ember-feature-flags`. Consumers import from here:
 *
 *   import { variation, initialize } from 'ember-feature-flags';
 *   import type { FlagUser, DriftReporter } from 'ember-feature-flags';
 *
 * The service is registered via Ember's container (`@service featureFlags`)
 * and does not need to be imported directly. The template helper is
 * registered by the addon's manifest and used as `{{variation "flag-name"}}`.
 *
 * This module deliberately pulls in **no third-party SDKs**, so importing it
 * never forces an optional peer dependency to be installed. Adapters and
 * reporters have their own subpath exports:
 *
 *   import { defaultAdapters } from 'ember-feature-flags/adapters';
 *   import LaunchDarklyAdapter from 'ember-feature-flags/adapters/launch-darkly';
 *   import { SentryDriftReporter } from 'ember-feature-flags/reporters';
 */
export { initialize, identify, setDriftReporter, variation, _setOwner, } from './variation.ts';
export type { FlagUser, VariationOptions, ChangeCallback, Unsubscribe, } from './adapters/base.ts';
export { default as BaseFeatureFlagAdapter } from './adapters/base.ts';
export type { DriftReporter, DriftAggregate, DriftSecondaryValue, DriftKind, } from './drift-reporter.ts';
export type { FeatureFlagsConfig, AdapterRegistry, AdapterLoader, } from './services/feature-flags.ts';
//# sourceMappingURL=index.d.ts.map