/**
 * Public entry point for `ember-feature-flags`. Consumers import from here:
 *
 *   import { variation, isEnabled } from 'ember-feature-flags';
 *   import type { FlagUser, DriftReporter } from 'ember-feature-flags';
 *
 * The service is registered via Ember's container (`@service featureFlags`)
 * and does not need to be imported directly. The template helper is
 * registered by the addon's manifest and used as `{{variation "flag-name"}}`.
 *
 * Adapters and reporters have their own subpath exports so consumers only
 * ship what they use:
 *
 *   import { defaultAdapters, LaunchDarklyAdapter } from 'ember-feature-flags/adapters';
 *   import { SentryDriftReporter } from 'ember-feature-flags/reporters';
 */

// Importable variation function for use in plain JS modules (routes, utils).
export { variation, _setOwner } from './variation.ts';

// Types every consumer needs to work with the API.
export type {
  FlagUser,
  VariationOptions,
  ChangeCallback,
  Unsubscribe,
} from './adapters/base.ts';

// Base adapter class so consumers can implement custom providers.
export { default as BaseFeatureFlagAdapter } from './adapters/base.ts';

// Drift types so consumers can implement custom reporters.
export type {
  DriftReporter,
  DriftAggregate,
  DriftKind,
} from './drift-reporter';

// Service config + adapter-registry types so consumers can strongly type
// their config block and their custom adapter registration.
export type {
  FeatureFlagsConfig,
  AdapterRegistry,
  AdapterLoader,
} from './services/feature-flags';

export { defaultAdapters } from './adapters/index.ts';
