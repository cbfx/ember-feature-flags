import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import type BaseFeatureFlagAdapter from '../adapters/base.ts';
import type {
  FlagUser,
  VariationOptions,
  Unsubscribe,
} from '../adapters/base.ts';
import type {
  DriftAggregate,
  DriftKind,
  DriftSecondaryValue,
  OnDrift,
} from '../drift-reporter.ts';

/**
 * A loader for an adapter class. Adapters aren't hardcoded into the service —
 * the consumer passes a registry mapping provider names to loaders on
 * `initialize()`. This keeps the service provider-agnostic and lets consumers
 * add their own adapters without forking the addon.
 */
export type AdapterLoader = () => Promise<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- adapter's TConfig is erased at this boundary; each adapter narrows on its own end
  new () => BaseFeatureFlagAdapter<any>
>;

export type AdapterRegistry = Record<string, AdapterLoader>;

/**
 * Config passed to `initialize()`. Provider-agnostic — each `providers[name]`
 * block is validated by that adapter's own `init()` at runtime.
 *
 * Consumers can get compile-time safety by importing an adapter's config
 * type and using `satisfies`:
 *
 *   import type { LaunchDarklyConfig } from 'ember-feature-flags/adapters/launch-darkly';
 *
 *   const config: FeatureFlagsConfig = {
 *     primary: 'launch-darkly',
 *     providers: {
 *       'launch-darkly': { clientSideId: '...' } satisfies LaunchDarklyConfig,
 *     },
 *   };
 */
export interface FeatureFlagsConfig {
  primary: string;
  secondaries?: string[];
  providers: Record<string, Record<string, unknown>>;
  drift?: {
    enabled?: boolean;
    flushIntervalMs?: number;
  };
}

export interface FeatureFlagsOptions {
  onDrift?: OnDrift;
}

const DEFAULT_FLUSH_INTERVAL_MS = 30_000;

/**
 * When several secondaries disagree in different ways, the aggregate's `kind`
 * reports the most significant one. A flag the primary doesn't know about at
 * all is more actionable than two providers returning different values.
 */
const KIND_PRIORITY: Record<DriftKind, number> = {
  missing_in_primary: 3,
  missing_in_secondary: 2,
  value_drift: 1,
};

/**
 * Flag values can be JSON objects or arrays, which `!==` compares by
 * reference — so two structurally identical values from different providers
 * would report drift on every read. Compares structurally, and is
 * key-order independent since two providers won't agree on ordering.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b)) return false;

  if (aIsArray) {
    const arrA = a as unknown[];
    const arrB = b as unknown[];
    return (
      arrA.length === arrB.length &&
      arrA.every((item, i) => valuesEqual(item, arrB[i]))
    );
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  return (
    keysA.length === keysB.length &&
    keysA.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(objB, key) &&
        valuesEqual(objA[key], objB[key]),
    )
  );
}

/**
 * Public feature-flag service. See README for lifecycle and usage.
 *
 * Reactivity: a single tracked `_revision` is bumped whenever any adapter
 * reports a change. `variation()` performs a tracked read of it so consumers
 * (component getters, template helpers) auto-subscribe.
 */
export default class FeatureFlagsService extends Service {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see AdapterLoader
  primary: BaseFeatureFlagAdapter<any> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see AdapterLoader
  secondaries: Map<string, BaseFeatureFlagAdapter<any>> = new Map();

  private brokenSecondaries: Set<string> = new Set();

  @tracked private _revision = 0;

  private primaryName: string | null = null;
  private driftEnabled = false;
  private driftAggregates: Map<string, DriftAggregate> = new Map();
  private onDrift: OnDrift | null = null;
  private flushIntervalId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;

  /**
   * Unsubscribe handles returned by each adapter's `onAnyChange`. Held so
   * `teardown()` can detach them — otherwise a re-initialize or a destroyed
   * service leaves adapters holding callbacks that bump `_revision` on a
   * dead service.
   */
  private changeUnsubscribes: Unsubscribe[] = [];

  async initialize(
    config: FeatureFlagsConfig,
    registry?: AdapterRegistry,
    options?: FeatureFlagsOptions,
  ): Promise<void> {
    if (!config?.primary) {
      throw new Error('[feature-flags] No primary provider configured.');
    }

    // Parity with ember-launch-darkly: a second initialize() is a no-op while
    // a provider is already active. This is what lets an acceptance test set
    // flags and then `visit()` without the app's own initialize discarding
    // them.
    if (this.primary) {
      return;
    }

    const activeRegistry =
      registry ?? (await import('../adapters/index.ts')).defaultAdapters;

    const primaryLoader = activeRegistry[config.primary];
    if (!primaryLoader) {
      throw new Error(
        `[feature-flags] No adapter registered for primary '${config.primary}'. ` +
          `Registered adapters: ${Object.keys(activeRegistry).join(', ') || '(none)'}. ` +
          `Provider adapters are opt-in — import the one you need (e.g. ` +
          `\`import LaunchDarklyAdapter from 'ember-feature-flags/adapters/launch-darkly'\`) ` +
          `and add it to the registry you pass to initialize().`,
      );
    }

    const primaryConfig = config.providers?.[config.primary] ?? {};
    const PrimaryClass = await primaryLoader();
    const primaryInstance = new PrimaryClass();
    await primaryInstance.init(primaryConfig);
    this.changeUnsubscribes.push(
      primaryInstance.onAnyChange(() => this._revision++),
    );

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
        this.changeUnsubscribes.push(
          adapter.onAnyChange(() => this._revision++),
        );
        this.secondaries.set(name, adapter);
      } catch (err) {
        console.error(
          `[feature-flags] Secondary '${name}' failed to init:`,
          err,
        );
        this.brokenSecondaries.add(name);
      }
    }

    // `drift.enabled: false` must switch off drift *detection*, not just the
    // flush timer. Otherwise aggregates accumulate on every flag read and are
    // never drained.
    this.driftEnabled =
      config.drift?.enabled !== false && this.secondaries.size > 0;

    this.onDrift = options?.onDrift ?? null;

    if (this.driftEnabled) {
      this.startDriftFlushing(
        config.drift?.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
      );
    }
  }

  async identify(
    user: FlagUser,
    traits: Record<string, unknown> = {},
  ): Promise<void> {
    this._revision++;
    const promises: Array<Promise<void>> = [];

    if (this.primary) {
      promises.push(this.primary.identify(user, traits));
    }
    for (const [name, adapter] of this.secondaries) {
      if (this.brokenSecondaries.has(name)) continue;
      promises.push(
        adapter.identify(user, traits).catch((err: unknown) => {
          console.error(
            `[feature-flags] Secondary '${name}' identify failed:`,
            err,
          );
          this.brokenSecondaries.add(name);
        }),
      );
    }

    await Promise.all(promises);
  }

  variation<T = unknown>(
    flagName: string,
    options: VariationOptions<T> = {},
  ): T {
    void this._revision;

    const primaryValue = (this.primary?.variation(flagName, options) ??
      options.defaultValue) as T;

    if (this.driftEnabled && this.primary && this.primaryName) {
      this.checkDrift(flagName, primaryValue);
    }

    return primaryValue;
  }

  isEnabled(
    flagName: string,
    options: VariationOptions<boolean> = {},
  ): boolean {
    return Boolean(this.variation<boolean>(flagName, options));
  }

  private checkDrift(flagName: string, primaryValue: unknown): void {
    const secondaryValues: Record<string, DriftSecondaryValue> = {};
    let aggregateKind: DriftKind | null = null;

    const primaryMissing = primaryValue === undefined;

    for (const [name, adapter] of this.secondaries) {
      if (this.brokenSecondaries.has(name)) continue;

      let value: unknown;
      try {
        value = adapter.variation(flagName, {});
      } catch (err) {
        console.error(`[feature-flags] Secondary '${name}' read failed:`, err);
        this.brokenSecondaries.add(name);
        continue;
      }

      const secondaryMissing = value === undefined;
      let kind: DriftKind;

      if (primaryMissing && !secondaryMissing) {
        kind = 'missing_in_primary';
        secondaryValues[name] = { kind, value };
      } else if (!primaryMissing && secondaryMissing) {
        kind = 'missing_in_secondary';
        // No `value` key at all — `missing: true` is the signal. A sentinel
        // Symbol here would vanish from any JSON payload.
        secondaryValues[name] = { kind, missing: true };
      } else if (!valuesEqual(value, primaryValue)) {
        kind = 'value_drift';
        secondaryValues[name] = { kind, value };
      } else {
        continue;
      }

      if (
        aggregateKind === null ||
        KIND_PRIORITY[kind] > KIND_PRIORITY[aggregateKind]
      ) {
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
    } else {
      this.driftAggregates.set(flagName, {
        flag: flagName,
        kind: aggregateKind,
        primary: { provider: this.primaryName as string, value: primaryValue },
        secondaries: secondaryValues,
        count: 1,
        firstSeen: now,
        lastSeen: now,
      });
    }
  }

  flushDrift(): void {
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
        result.catch((err: unknown) =>
          console.error('[feature-flags] onDrift rejected:', err),
        );
      }
    } catch (err) {
      console.error('[feature-flags] onDrift threw:', err);
    }
  }

  private startDriftFlushing(intervalMs: number): void {
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
  private async teardown(): Promise<void> {
    if (this.flushIntervalId !== null) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }

    if (this.visibilityHandler) {
      if (typeof document !== 'undefined') {
        document.removeEventListener(
          'visibilitychange',
          this.visibilityHandler,
        );
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

    const adapters = [
      ...(this.primary ? [this.primary] : []),
      ...this.secondaries.values(),
    ];

    this.primary = null;
    this.primaryName = null;
    this.secondaries = new Map();
    this.brokenSecondaries = new Set();
    this.driftEnabled = false;

    await Promise.all(
      adapters.map(async (adapter) => {
        try {
          await adapter.shutdown();
        } catch (err) {
          console.error('[feature-flags] Adapter shutdown threw:', err);
        }
      }),
    );
  }

  willDestroy(): void {
    super.willDestroy();
    // `willDestroy` is synchronous; shutdown is fire-and-forget. The
    // synchronous parts of teardown (timer, listeners, flush) have already
    // run by the time this promise is pending.
    void this.teardown();
  }
}

declare module '@ember/service' {
  interface Registry {
    'feature-flags': FeatureFlagsService;
  }
}
