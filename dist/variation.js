export { default as BaseFeatureFlagAdapter } from './adapters/base.js';

/**
 * Importable API for use in plain JS modules — routes, utilities, anywhere
 * `@service` injection isn't ergonomic.
 *
 * These functions look up the service via the owner captured at boot (see
 * `instance-initializers/feature-flags.ts`). Reactivity is limited: for a
 * reactive flag read use the template helper `{{variation}}` or inject the
 * service directly.
 */

let cachedOwner = null;

/**
 * Called once by `instance-initializers/feature-flags.ts` to give this
 * module a handle on the running app instance. Prefixed with `_` to signal
 * it's internal — consumers should never call this directly.
 */
function _setOwner(owner) {
  cachedOwner = owner;
}
function getService() {
  if (!cachedOwner) throw new Error('feature-flags not initialized');
  // The service registry augmentation in services/feature-flags.ts already
  // types this lookup, so no cast is needed.
  return cachedOwner.lookup('service:feature-flags');
}

/**
 * Initialize the feature-flag service from outside a component/route.
 * Mirrors `ember-launch-darkly`'s top-level `initialize()` for
 * find-and-replace migration.
 *
 * Consumers can also call `this.featureFlags.initialize(...)` directly if
 * the service is already injected — behavior is identical.
 */
async function initialize(config, registry) {
  await getService().initialize(config, registry);
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
async function identify(user, traits = {}) {
  await getService().identify(user, traits);
}

/**
 * Read a flag's value from outside a component. Not reactive — reads at
 * call time.
 */
function variation(flagName, options) {
  return getService().variation(flagName, options);
}
function setDriftReporter(reporter) {
  getService().setDriftReporter(reporter);
}

export { _setOwner, identify, initialize, setDriftReporter, variation };
//# sourceMappingURL=variation.js.map
