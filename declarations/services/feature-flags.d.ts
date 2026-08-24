import Service from '@ember/service';
import type BaseFeatureFlagAdapter from '../adapters/base.ts';
import type { FlagUser, VariationOptions } from '../adapters/base.ts';
import type { OnDrift } from '../drift-reporter.ts';
/**
 * A loader for an adapter class. Adapters aren't hardcoded into the service —
 * the consumer passes a registry mapping provider names to loaders on
 * `initialize()`. This keeps the service provider-agnostic and lets consumers
 * add their own adapters without forking the addon.
 */
export type AdapterLoader = () => Promise<new () => BaseFeatureFlagAdapter<any>>;
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
/**
 * Public feature-flag service. See README for lifecycle and usage.
 *
 * Reactivity: a single tracked `_revision` is bumped whenever any adapter
 * reports a change. `variation()` performs a tracked read of it so consumers
 * (component getters, template helpers) auto-subscribe.
 */
export default class FeatureFlagsService extends Service {
    primary: BaseFeatureFlagAdapter<any> | null;
    secondaries: Map<string, BaseFeatureFlagAdapter<any>>;
    private brokenSecondaries;
    private _revision;
    private primaryName;
    private driftEnabled;
    private driftAggregates;
    private onDrift;
    private flushIntervalId;
    private visibilityHandler;
    /**
     * Unsubscribe handles returned by each adapter's `onAnyChange`. Held so
     * `teardown()` can detach them — otherwise a re-initialize or a destroyed
     * service leaves adapters holding callbacks that bump `_revision` on a
     * dead service.
     */
    private changeUnsubscribes;
    initialize(config: FeatureFlagsConfig, registry?: AdapterRegistry, options?: FeatureFlagsOptions): Promise<void>;
    identify(user: FlagUser, traits?: Record<string, unknown>): Promise<void>;
    variation<T = unknown>(flagName: string, options?: VariationOptions<T>): T;
    isEnabled(flagName: string, options?: VariationOptions<boolean>): boolean;
    private checkDrift;
    flushDrift(): void;
    private startDriftFlushing;
    /**
     * Detach timers, listeners and adapter subscriptions, flush whatever is
     * pending, and shut the adapters down. Idempotent.
     */
    private teardown;
    willDestroy(): void;
}
declare module '@ember/service' {
    interface Registry {
        'feature-flags': FeatureFlagsService;
    }
}
//# sourceMappingURL=feature-flags.d.ts.map