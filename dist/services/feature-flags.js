import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { ConsoleDriftReporter } from '../reporters/console.js';
import { g, i } from 'decorator-transforms/runtime-esm';

/**
 * Copyright IBM Corp. 2020, 2026
 */

const DEFAULT_FLUSH_INTERVAL_MS = 30_000;

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
  driftAggregates = new Map();
  driftReporter = new ConsoleDriftReporter();
  flushIntervalId = null;
  unloadHandler = null;
  setDriftReporter(reporter) {
    this.driftReporter = reporter;
  }
  async initialize(config, registry) {
    if (!config?.primary) {
      throw new Error('[feature-flags] No primary provider configured.');
    }
    const activeRegistry = registry ?? (await import('../adapters/index.js')).defaultAdapters;
    const primaryLoader = activeRegistry[config.primary];
    if (!primaryLoader) {
      throw new Error(`[feature-flags] No adapter registered for primary '${config.primary}'.`);
    }
    const primaryConfig = config.providers[config.primary] ?? {};
    const PrimaryClass = await primaryLoader();
    const primaryInstance = new PrimaryClass();
    await primaryInstance.init(primaryConfig);
    primaryInstance.onAnyChange(() => this._revision++);
    this.primary = primaryInstance;
    this.primaryName = config.primary;
    for (const name of config.secondaries ?? []) {
      try {
        const loader = activeRegistry[name];
        if (!loader) {
          throw new Error(`No adapter registered for secondary '${name}'.`);
        }
        const secondaryConfig = config.providers[name] ?? {};
        const SecondaryClass = await loader();
        const adapter = new SecondaryClass();
        await adapter.init(secondaryConfig);
        adapter.onAnyChange(() => this._revision++);
        this.secondaries.set(name, adapter);
      } catch (err) {
        console.error(`[feature-flags] Secondary '${name}' failed to init:`, err);
        this.brokenSecondaries.add(name);
      }
    }
    if (config.drift?.enabled !== false && this.secondaries.size > 0) {
      this.startDriftFlushing(config.drift?.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS);
    }
  }
  async identify(user, traits = {}) {
    this._revision++;
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
    if (this.secondaries.size > 0 && this.primary && this.primaryName) {
      this.checkDrift(flagName, primaryValue);
    }
    return primaryValue;
  }
  isEnabled(flagName, options = {}) {
    return Boolean(this.variation(flagName, options));
  }
  checkDrift(flagName, primaryValue) {
    const secondaryValues = {};
    let hasMismatch = false;
    let kind = 'value_drift';
    const missingSentinel = Symbol('missing');
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
      if (primaryMissing && !secondaryMissing) {
        hasMismatch = true;
        kind = 'missing_in_primary';
        secondaryValues[name] = value;
      } else if (!primaryMissing && secondaryMissing) {
        hasMismatch = true;
        kind = 'missing_in_secondary';
        secondaryValues[name] = missingSentinel;
      } else if (value !== primaryValue) {
        hasMismatch = true;
        kind = 'value_drift';
        secondaryValues[name] = value;
      }
    }
    if (!hasMismatch) return;
    const now = Date.now();
    const existing = this.driftAggregates.get(flagName);
    if (existing) {
      existing.count += 1;
      existing.lastSeen = now;
      existing.secondaries = secondaryValues;
      existing.primary.value = primaryValue;
      existing.kind = kind;
    } else {
      this.driftAggregates.set(flagName, {
        flag: flagName,
        kind,
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
    try {
      const result = this.driftReporter.report(batch);
      if (result instanceof Promise) {
        result.catch(err => console.error('[feature-flags] Drift reporter rejected:', err));
      }
    } catch (err) {
      console.error('[feature-flags] Drift reporter threw:', err);
    }
  }
  startDriftFlushing(intervalMs) {
    this.flushIntervalId = setInterval(() => this.flushDrift(), intervalMs);
    if (typeof window !== 'undefined') {
      this.unloadHandler = () => this.flushDrift();
      window.addEventListener('visibilitychange', this.unloadHandler);
      window.addEventListener('pagehide', this.unloadHandler);
    }
  }
  willDestroy() {
    super.willDestroy();
    if (this.flushIntervalId !== null) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
    if (this.unloadHandler && typeof window !== 'undefined') {
      window.removeEventListener('visibilitychange', this.unloadHandler);
      window.removeEventListener('pagehide', this.unloadHandler);
      this.unloadHandler = null;
    }
    this.flushDrift();
    void this.primary?.shutdown();
    for (const adapter of this.secondaries.values()) {
      void adapter.shutdown();
    }
  }
}

export { FeatureFlagsService as default };
//# sourceMappingURL=feature-flags.js.map
