/**
 * Copyright IBM Corp. 2020, 2026
 */

import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import type BaseFeatureFlagAdapter from '../adapters/base.ts';
import type { FlagUser, VariationOptions } from '../adapters/base.ts';
import type {
  DriftReporter,
  DriftAggregate,
  DriftKind,
} from '../drift-reporter.ts';
import { ConsoleDriftReporter } from '../reporters/console.ts';

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

const DEFAULT_FLUSH_INTERVAL_MS = 30_000;

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
  private driftAggregates: Map<string, DriftAggregate> = new Map();
  private driftReporter: DriftReporter = new ConsoleDriftReporter();
  private flushIntervalId: ReturnType<typeof setInterval> | null = null;
  private unloadHandler: (() => void) | null = null;

  setDriftReporter(reporter: DriftReporter): void {
    this.driftReporter = reporter;
  }

  async initialize(
    config: FeatureFlagsConfig,
    registry?: AdapterRegistry,
  ): Promise<void> {
    if (!config?.primary) {
      throw new Error('[feature-flags] No primary provider configured.');
    }

    const activeRegistry =
      registry ?? (await import('../adapters/index.ts')).defaultAdapters;

    const primaryLoader = activeRegistry[config.primary];
    if (!primaryLoader) {
      throw new Error(
        `[feature-flags] No adapter registered for primary '${config.primary}'.`,
      );
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
        console.error(
          `[feature-flags] Secondary '${name}' failed to init:`,
          err,
        );
        this.brokenSecondaries.add(name);
      }
    }

    if (config.drift?.enabled !== false && this.secondaries.size > 0) {
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

    if (this.secondaries.size > 0 && this.primary && this.primaryName) {
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
    const secondaryValues: Record<string, unknown> = {};
    let hasMismatch = false;
    let kind: DriftKind = 'value_drift';

    const missingSentinel = Symbol('missing');
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
    try {
      const result = this.driftReporter.report(batch);
      if (result instanceof Promise) {
        result.catch((err: unknown) =>
          console.error('[feature-flags] Drift reporter rejected:', err),
        );
      }
    } catch (err) {
      console.error('[feature-flags] Drift reporter threw:', err);
    }
  }

  private startDriftFlushing(intervalMs: number): void {
    this.flushIntervalId = setInterval(() => this.flushDrift(), intervalMs);

    if (typeof window !== 'undefined') {
      this.unloadHandler = () => this.flushDrift();
      window.addEventListener('visibilitychange', this.unloadHandler);
      window.addEventListener('pagehide', this.unloadHandler);
    }
  }

  willDestroy(): void {
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

declare module '@ember/service' {
  interface Registry {
    'feature-flags': FeatureFlagsService;
  }
}
