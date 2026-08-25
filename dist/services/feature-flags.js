import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { g, i } from 'decorator-transforms/runtime-esm';

const DEFAULT_FLUSH_INTERVAL_MS = 30_000;

/**
 * When several secondaries disagree in different ways, the aggregate's `kind`
 * reports the most significant one. A flag the primary doesn't know about at
 * all is more actionable than two providers returning different values.
 */
const KIND_PRIORITY = {
  missing_in_primary: 3,
  missing_in_secondary: 2,
  value_drift: 1
};

/**
 * Flag values can be JSON objects or arrays, which `!==` compares by
 * reference — so two structurally identical values from different providers
 * would report drift on every read. Compares structurally, and is
 * key-order independent since two providers won't agree on ordering.
 */
function valuesEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b)) return false;
  if (aIsArray) {
    const arrA = a;
    const arrB = b;
    return arrA.length === arrB.length && arrA.every((item, i) => valuesEqual(item, arrB[i]));
  }
  const objA = a;
  const objB = b;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  return keysA.length === keysB.length && keysA.every(key => Object.prototype.hasOwnProperty.call(objB, key) && valuesEqual(objA[key], objB[key]));
}

/**
 * Public feature-flag service. See README for lifecycle and usage.
 *
 * Reactivity: a single tracked `_revision` is bumped whenever any adapter
 * reports a change. `variation()` performs a tracked read of it so consumers
 * (component getters, template helpers) auto-subscribe.
 */
class FeatureFlagsService extends Service {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see AdapterLoader
  primary = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see AdapterLoader
  secondaries = new Map();
  brokenSecondaries = new Set();
  static {
    g(this.prototype, "_revision", [tracked], function () {
      return 0;
    });
  }
  #_revision = (i(this, "_revision"), void 0);
  primaryName = null;
  driftEnabled = false;
  driftAggregates = new Map();
  driftAttributeKeys = [];
  driftAttributes = {};
  onDrift = null;
  flushIntervalId = null;
  visibilityHandler = null;

  /**
   * Unsubscribe handles returned by each adapter's `onAnyChange`. Held so
   * `teardown()` can detach them — otherwise a re-initialize or a destroyed
   * service leaves adapters holding callbacks that bump `_revision` on a
   * dead service.
   */
  changeUnsubscribes = [];
  async initialize(config, registry, options) {
    if (!config?.primary) {
      throw new Error('[feature-flags] No primary provider configured.');
    }

    // Registered before the no-op guard below. In an acceptance test
    // `setupFeatureFlags` initializes the providers first, so the app's own
    // `initialize()` returns early — but its drift callback still has to
    // land, or real drift reporting is silently replaced by `console.warn`.
    // Registering is not invoking: `flushDrift()` only fires when a primary
    // and at least one secondary actually disagree.
    if (options?.onDrift) {
      this.onDrift = options.onDrift;
    }

    // Parity with ember-launch-darkly: a second initialize() is a no-op while
    // a provider is already active. This is what lets an acceptance test set
    // flags and then `visit()` without the app's own initialize discarding
    // them.
    if (this.primary) {
      return;
    }
    const activeRegistry = registry ?? (await import('../adapters/index.js')).defaultAdapters;
    const primaryLoader = activeRegistry[config.primary];
    if (!primaryLoader) {
      throw new Error(`[feature-flags] No adapter registered for primary '${config.primary}'. ` + `Registered adapters: ${Object.keys(activeRegistry).join(', ') || '(none)'}. ` + `Provider adapters are opt-in — import the one you need (e.g. ` + `\`import LaunchDarklyAdapter from 'ember-feature-flags/adapters/launch-darkly'\`) ` + `and add it to the registry you pass to initialize().`);
    }
    const primaryConfig = config.providers?.[config.primary] ?? {};
    const PrimaryClass = await primaryLoader();
    const primaryInstance = new PrimaryClass();
    await primaryInstance.init(primaryConfig);
    this.changeUnsubscribes.push(primaryInstance.onAnyChange(() => this._revision++));
    this.primary = primaryInstance;
    this.primaryName = config.primary;
    for (const name of config.secondaries ?? []) {
      try {
        const loader = activeRegistry[name];
        if (!loader) {
          throw new Error(`No adapter registered for secondary '${name}'.`);
        }
        const secondaryConfig = config.providers?.[name] ?? {};
        const SecondaryClass = await loader();
        const adapter = new SecondaryClass();
        await adapter.init(secondaryConfig);
        this.changeUnsubscribes.push(adapter.onAnyChange(() => this._revision++));
        this.secondaries.set(name, adapter);
      } catch (err) {
        console.error(`[feature-flags] Secondary '${name}' failed to init:`, err);
        this.brokenSecondaries.add(name);
      }
    }

    // `drift.enabled: false` must switch off drift *detection*, not just the
    // flush timer. Otherwise aggregates accumulate on every flag read and are
    // never drained.
    this.driftEnabled = config.drift?.enabled !== false && this.secondaries.size > 0;
    this.driftAttributeKeys = config.drift?.includeAttributes ?? [];
    if (this.driftEnabled) {
      this.startDriftFlushing(config.drift?.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS);
    }
  }
  async identify(user, traits = {}) {
    this._revision++;
    if (this.driftAttributeKeys.length > 0) {
      const identity = {
        ...user,
        ...traits
      };
      this.driftAttributes = Object.fromEntries(this.driftAttributeKeys.filter(key => identity[key] !== undefined).map(key => [key, identity[key]]));
    }
    const promises = [];
    if (this.primary) {
      promises.push(this.primary.identify(user, traits));
    }
    for (const [name, adapter] of this.secondaries) {
      if (this.brokenSecondaries.has(name)) continue;
      promises.push(adapter.identify(user, traits).catch(err => {
        console.error(`[feature-flags] Secondary '${name}' identify failed:`, err);
        this.brokenSecondaries.add(name);
      }));
    }
    await Promise.all(promises);
  }
  variation(flagName, options = {}) {
    void this._revision;
    const primaryValue = this.primary?.variation(flagName, options) ?? options.defaultValue;
    if (this.driftEnabled && this.primary && this.primaryName) {
      this.checkDrift(flagName, primaryValue);
    }
    return primaryValue;
  }
  isEnabled(flagName, options = {}) {
    return Boolean(this.variation(flagName, options));
  }
  checkDrift(flagName, primaryValue) {
    const secondaryValues = {};
    let aggregateKind = null;
    const primaryMissing = primaryValue === undefined;
    for (const [name, adapter] of this.secondaries) {
      if (this.brokenSecondaries.has(name)) continue;
      let value;
      try {
        value = adapter.variation(flagName, {});
      } catch (err) {
        console.error(`[feature-flags] Secondary '${name}' read failed:`, err);
        this.brokenSecondaries.add(name);
        continue;
      }
      const secondaryMissing = value === undefined;
      let kind;
      if (primaryMissing && !secondaryMissing) {
        kind = 'missing_in_primary';
        secondaryValues[name] = {
          kind,
          value
        };
      } else if (!primaryMissing && secondaryMissing) {
        kind = 'missing_in_secondary';
        // No `value` key at all — `missing: true` is the signal. A sentinel
        // Symbol here would vanish from any JSON payload.
        secondaryValues[name] = {
          kind,
          missing: true
        };
      } else if (!valuesEqual(value, primaryValue)) {
        kind = 'value_drift';
        secondaryValues[name] = {
          kind,
          value
        };
      } else {
        continue;
      }
      if (aggregateKind === null || KIND_PRIORITY[kind] > KIND_PRIORITY[aggregateKind]) {
        aggregateKind = kind;
      }
    }
    if (aggregateKind === null) return;
    const now = Date.now();
    const existing = this.driftAggregates.get(flagName);
    if (existing) {
      existing.count += 1;
      existing.lastSeen = now;
      existing.secondaries = secondaryValues;
      existing.primary.value = primaryValue;
      existing.kind = aggregateKind;
      existing.attributes = {
        ...this.driftAttributes
      };
    } else {
      this.driftAggregates.set(flagName, {
        attributes: {
          ...this.driftAttributes
        },
        flag: flagName,
        kind: aggregateKind,
        primary: {
          provider: this.primaryName,
          value: primaryValue
        },
        secondaries: secondaryValues,
        count: 1,
        firstSeen: now,
        lastSeen: now
      });
    }
  }
  flushDrift() {
    if (this.driftAggregates.size === 0) return;
    const batch = Array.from(this.driftAggregates.values());
    this.driftAggregates.clear();
    if (!this.onDrift) {
      for (const agg of batch) console.warn('[feature-flags] drift:', agg);
      return;
    }
    try {
      const result = this.onDrift(batch);
      if (result instanceof Promise) {
        result.catch(err => console.error('[feature-flags] onDrift rejected:', err));
      }
    } catch (err) {
      console.error('[feature-flags] onDrift threw:', err);
    }
  }
  startDriftFlushing(intervalMs) {
    this.flushIntervalId = setInterval(() => this.flushDrift(), intervalMs);
    if (typeof document !== 'undefined') {
      // `visibilitychange` fires on both hide and show; only a hide is a
      // last-chance opportunity to get the batch out. `pagehide` covers
      // navigations that skip the hidden state.
      this.visibilityHandler = () => {
        if (document.visibilityState === 'hidden') this.flushDrift();
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
      window.addEventListener('pagehide', this.visibilityHandler);
    }
  }

  /**
   * Detach timers, listeners and adapter subscriptions, flush whatever is
   * pending, and shut the adapters down. Idempotent.
   */
  async teardown() {
    if (this.flushIntervalId !== null) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
    if (this.visibilityHandler) {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this.visibilityHandler);
        window.removeEventListener('pagehide', this.visibilityHandler);
      }
      this.visibilityHandler = null;
    }
    for (const unsubscribe of this.changeUnsubscribes) {
      try {
        unsubscribe();
      } catch (err) {
        console.error('[feature-flags] Adapter unsubscribe threw:', err);
      }
    }
    this.changeUnsubscribes = [];
    this.flushDrift();
    const adapters = [...(this.primary ? [this.primary] : []), ...this.secondaries.values()];
    this.primary = null;
    this.primaryName = null;
    this.secondaries = new Map();
    this.brokenSecondaries = new Set();
    this.driftEnabled = false;
    await Promise.all(adapters.map(async adapter => {
      try {
        await adapter.shutdown();
      } catch (err) {
        console.error('[feature-flags] Adapter shutdown threw:', err);
      }
    }));
  }
  willDestroy() {
    super.willDestroy();
    // `willDestroy` is synchronous; shutdown is fire-and-forget. The
    // synchronous parts of teardown (timer, listeners, flush) have already
    // run by the time this promise is pending.
    void this.teardown();
  }
}

export { FeatureFlagsService as default };
//# sourceMappingURL=feature-flags.js.map
