import {
  initialize,
  identify as ldIdentify,
  variation as ldVariation,
} from 'ember-launch-darkly';
import BaseFeatureFlagAdapter, {
  type FlagUser,
  type VariationOptions,
  type ChangeCallback,
  type Unsubscribe,
} from './base.ts';

/**
 * Config shape for the LaunchDarkly adapter, matching what
 * `plugins/html-build-targets.mjs` sets under `FEATURE_FLAGS.config`.
 *
 * Consumers can use this with `satisfies` to strongly-type their config
 * block.
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
  [key: string]: unknown;
}

/**
 * LaunchDarkly adapter, wrapping `ember-launch-darkly` (which itself wraps
 * `launchdarkly-js-client-sdk`). We talk to the addon rather than the raw
 * SDK so reactivity, the helper, and identify all flow through one path.
 *
 * Provider-specific quirks worth knowing:
 *  - The anonymous user `key` is a per-session UUID. New on every page
 *    load, intentional — anon users don't need to be sticky here.
 *  - `FlagUser.id` is mapped to LD's context `key` inside `identify()`.
 *  - LD's modern context format wants `kind: 'user'`, but
 *    `ember-launch-darkly`'s `identify()` types reject it — the addon
 *    adds `kind` internally, so we omit it here.
 *  - If init fails (network down, bad key), we tear the client down and
 *    re-init in `local` mode against `localFlags`. The app keeps working
 *    with whatever defaults the local flags provide.
 */
export default class LaunchDarklyAdapter extends BaseFeatureFlagAdapter<LaunchDarklyConfig> {
  // eslint-disable-next-line ember/classic-decorator-hooks
  async init(config: LaunchDarklyConfig): Promise<void> {
    const { clientSideId, ...options } = config;

    // Anonymous user lives only until the real user logs in and identify()
    // is called. A fresh UUID per session is fine — see class comment.
    const user = {
      anonymous: true,
      key: crypto.randomUUID(),
    };

    const { isOk, error, context } = await initialize(
      clientSideId,
      user,
      options,
    );

    if (!isOk) {
      console.warn('LaunchDarkly failed to initialize:', error);
      // Tear down the failed remote client before re-initing locally,
      // otherwise we leak its background reconnect attempts.
      await context.destroy({ force: true });
      await initialize(clientSideId, user, {
        mode: 'local',
        localFlags: config.localFlags,
      });
    }
  }

  /**
   * Swap the anonymous user for the real one. Errors are logged but don't
   * throw — a failed identify shouldn't break the app, flags just stay
   * scoped to the previous (anonymous) user.
   */
  async identify(
    user: FlagUser,
    traits: Record<string, unknown> = {},
  ): Promise<void> {
    const { isOk, error } = await ldIdentify({
      key: user.id,
      name: user.name,
      email: user.email,
      ...traits,
    });

    if (!isOk) {
      console.error('LaunchDarkly failed to identify:', error);
    }
  }

  variation<T = unknown>(
    flagName: string,
    { defaultValue }: VariationOptions<T> = {},
  ): T {
    const value = ldVariation(flagName);
    return (value ?? defaultValue) as T;
  }

  /**
   * No-op: `ember-launch-darkly`'s `variation()` is already reactive
   * through its own tracked internals, so the service's `_revision`
   * counter doesn't need to be bumped on flag changes for this adapter.
   * Other adapters (test, hypothetical raw SDK wrappers) do need it.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onAnyChange(_callback: ChangeCallback): Unsubscribe {
    return () => {};
  }
}
