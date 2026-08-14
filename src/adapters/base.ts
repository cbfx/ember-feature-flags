export interface FlagUser {
  id: string;
  email?: string;
  name?: string;
}

export interface VariationOptions<T = unknown> {
  defaultValue?: T;
}

export type ChangeCallback = () => void;
export type Unsubscribe = () => void;

/**
 * Contract every feature-flag provider adapter must implement.
 *
 * Adapters are thin translation layers between this contract and a specific
 * provider's SDK. Config is passed as an opaque `Record<string, unknown>`;
 * each adapter is responsible for narrowing it to its own expected shape
 * inside `init()`.
 *
 * Each adapter should also export its own config interface so consumers can
 * strongly-type their config block via the `satisfies` operator.
 */
export default abstract class BaseFeatureFlagAdapter<
  TConfig = Record<string, unknown>,
> {
  /**
   * Initialize the adapter. Called once at app boot via
   * `featureFlags.initialize()`. The config is whatever the host's
   * `FEATURE_FLAGS.providers[<name>]` block contains for this adapter —
   * the adapter narrows it to its own expected shape.
   */
  abstract init(_config: TConfig): Promise<void>;

  /**
   * Re-identify the current user. Called after login when the real user
   * becomes known. Before this, the adapter typically operates against an
   * anonymous user set up during `init()`.
   */
  abstract identify(
    _user: FlagUser,
    _traits?: Record<string, unknown>,
  ): Promise<void>;

  /**
   * Read a flag's current value. Should be synchronous and cheap — typically
   * a lookup in the provider SDK's in-memory cache. Falls back to
   * `options.defaultValue` if the flag is unknown.
   */
  abstract variation<T = unknown>(
    _flagName: string,
    _options?: VariationOptions<T>,
  ): T;

  /**
   * Subscribe to any flag change. The service uses this to bump a tracked
   * counter that drives template reactivity. Returns an unsubscribe function.
   *
   * For providers whose own `variation()` is already reactive (e.g.
   * `ember-launch-darkly`), this can be a no-op.
   */
  abstract onAnyChange(_callback: ChangeCallback): Unsubscribe;

  /** Optional teardown. Called from `service.willDestroy()`. */
  shutdown(): Promise<void> | void {}
}
