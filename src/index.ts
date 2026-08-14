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

// Importable variation function for use in plain JS modules (routes, utils).
export {
  variation,
  initialize,
  identify,
  setDriftReporter,
  _setService,
} from './variation.ts';

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
  DriftSecondaryValue,
  DriftKind,
} from './drift-reporter.ts';

// Service config + adapter-registry types so consumers can strongly type
// their config block and their custom adapter registration.
export type {
  FeatureFlagsConfig,
  AdapterRegistry,
  AdapterLoader,
} from './services/feature-flags.ts';

// NOTE: `defaultAdapters` is intentionally *not* re-exported here. Doing so
// would put every provider adapter — and therefore every provider SDK — into
// the module graph of anyone who imports anything from 'ember-feature-flags'.
// Import it from 'ember-feature-flags/adapters' instead.
