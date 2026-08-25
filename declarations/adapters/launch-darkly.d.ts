import BaseFeatureFlagAdapter, { type FlagUser, type VariationOptions, type ChangeCallback, type Unsubscribe } from './base.ts';
/**
 * Config shape for the LaunchDarkly adapter, matching what
 * `plugins/html-build-targets.mjs` sets under `FEATURE_FLAGS.providers['launch-darkly']`.
 *
 * Consumers can use this with `satisfies` to strongly-type their config block.
 *
 * Anything not listed here (additional `LDOptions` fields like `bootstrap`,
 * `streaming`, etc.) is forwarded to `ember-launch-darkly` via the
 * index signature.
 */
export interface LaunchDarklyConfig {
    /** LaunchDarkly project's client-side ID. */
    clientSideId: string;
    /**
     * `remote` talks to LaunchDarkly. `local` reads from `localFlags` only
     * (no network). Used in dev and as a fallback when remote init fails.
     */
    mode?: 'remote' | 'local';
    /** Flag-name → value map used when `mode: 'local'`. */
    localFlags?: Record<string, unknown>;
    /**
     * Persist the anonymous context in localStorage under this key so the
     * same anonymous user persists across sessions. Omit for per-session
     * UUID (the default).
     */
    anonymousContextStorageKey?: string;
    /** Extra attributes merged into the anonymous context on first creation. */
    anonymousContextAttributes?: Record<string, unknown>;
    /** Init timeout in milliseconds. Passed to LD as seconds. */
    timeoutMs?: number;
    /**
     * Timeout used on the next init if a recent init failed. Remembered
     * under `timeoutFailureStorageKey` for `timeoutFailureCooldownMs`.
     */
    shortenedTimeoutMs?: number;
    /**
     * localStorage key that remembers a recent init timeout failure. When
     * set together with `shortenedTimeoutMs`, enables the shortened-timeout
     * path on subsequent inits within the cooldown window.
     */
    timeoutFailureStorageKey?: string;
    /** How long a remembered failure stays effective. Default 5 minutes. */
    timeoutFailureCooldownMs?: number;
    [key: string]: unknown;
}
/**
 * LaunchDarkly adapter, wrapping `ember-launch-darkly` (which itself wraps
 * `launchdarkly-js-client-sdk`). We talk to the addon rather than the raw
 * SDK so reactivity, the helper, and identify all flow through one path.
 *
 * Provider-specific quirks worth knowing:
 *  - Anonymous user is per-session (fresh UUID on each page load) unless
 *    `anonymousContextStorageKey` is set — then the context is persisted
 *    in localStorage and reused.
 *  - `FlagUser.id` is mapped to LD's context `key` inside `identify()`.
 *  - LD's modern context format wants `kind: 'user'`, but
 *    `ember-launch-darkly`'s `identify()` types reject it — the addon
 *    adds `kind` internally, so we omit it here.
 *  - If init fails (network down, bad key), we tear the client down and
 *    re-init in `local` mode against `localFlags`. If a
 *    `timeoutFailureStorageKey` is configured, the failure is remembered
 *    so subsequent inits within the cooldown use `shortenedTimeoutMs`
 *    to fail fast.
 */
export default class LaunchDarklyAdapter extends BaseFeatureFlagAdapter<LaunchDarklyConfig> {
    init(config: LaunchDarklyConfig): Promise<void>;
    private resolveAnonymousContext;
    private resolveTimeout;
    private rememberTimeoutFailure;
    /**
     * Swap the anonymous user for the real one. Errors are logged but don't
     * throw — a failed identify shouldn't break the app, flags just stay
     * scoped to the previous (anonymous) user.
     */
    identify(user: FlagUser, traits?: Record<string, unknown>): Promise<void>;
    variation<T = unknown>(flagName: string, { defaultValue }?: VariationOptions<T>): T;
    /**
     * No-op: `ember-launch-darkly`'s `variation()` is already reactive
     * through its own tracked internals, so the service's `_revision`
     * counter doesn't need to be bumped on flag changes for this adapter.
     */
    onAnyChange(_callback: ChangeCallback): Unsubscribe;
}
//# sourceMappingURL=launch-darkly.d.ts.map