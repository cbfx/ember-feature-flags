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
import { randomId } from '../utils/uuid.ts';

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
  // eslint-disable-next-line ember/classic-decorator-hooks
  async init(config: LaunchDarklyConfig): Promise<void> {
    const {
      clientSideId,
      anonymousContextStorageKey,
      anonymousContextAttributes = {},
      timeoutMs,
      shortenedTimeoutMs,
      timeoutFailureStorageKey,
      timeoutFailureCooldownMs = 5 * 60 * 1000,
      localFlags,
      ...options
    } = config;

    const anonymousContext = this.resolveAnonymousContext(
      anonymousContextStorageKey,
      anonymousContextAttributes,
    );

    const effectiveTimeoutMs = this.resolveTimeout(
      timeoutMs,
      shortenedTimeoutMs,
      timeoutFailureStorageKey,
    );

    const initOptions = {
      ...options,
      ...(localFlags !== undefined && { localFlags }),
      ...(effectiveTimeoutMs !== undefined && {
        timeout: effectiveTimeoutMs / 1000,
      }),
    };

    const { isOk, error, context } = await initialize(
      clientSideId,
      anonymousContext,
      initOptions,
    );

    if (!isOk) {
      console.warn('LaunchDarkly failed to initialize:', error);
      this.rememberTimeoutFailure(
        timeoutFailureStorageKey,
        timeoutFailureCooldownMs,
      );
      // Tear down the failed remote client before re-initing locally,
      // otherwise we leak its background reconnect attempts. A failed init
      // can leave the context in a state where destroy() itself rejects —
      // that must not mask the local-mode fallback below.
      try {
        await context?.destroy({ force: true });
      } catch (destroyError) {
        console.warn(
          'LaunchDarkly failed to tear down after init failure:',
          destroyError,
        );
      }

      const fallback = await initialize(clientSideId, anonymousContext, {
        ...options,
        mode: 'local',
        localFlags,
      });

      if (!fallback.isOk) {
        // Nothing left to try. Surface it loudly rather than leaving the app
        // silently reading `defaultValue` for every flag.
        console.error(
          'LaunchDarkly local-mode fallback also failed:',
          fallback.error,
        );
      }
    }
  }

  private resolveAnonymousContext(
    storageKey: string | undefined,
    attributes: Record<string, unknown>,
  ): { anonymous: true; key: string; [key: string]: unknown } {
    if (storageKey && typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        try {
          return JSON.parse(stored) as {
            anonymous: true;
            key: string;
            [key: string]: unknown;
          };
        } catch {
          // Corrupted entry — fall through and recreate.
        }
      }
      const fresh = {
        anonymous: true as const,
        key: randomId(),
        ...attributes,
      };
      window.localStorage.setItem(storageKey, JSON.stringify(fresh));
      return fresh;
    }

    return {
      anonymous: true,
      key: randomId(),
      ...attributes,
    };
  }

  private resolveTimeout(
    timeoutMs: number | undefined,
    shortenedTimeoutMs: number | undefined,
    failureStorageKey: string | undefined,
  ): number | undefined {
    if (
      !failureStorageKey ||
      typeof window === 'undefined' ||
      shortenedTimeoutMs === undefined
    ) {
      return timeoutMs;
    }

    const expiry = Number(window.localStorage.getItem(failureStorageKey));
    if (expiry && expiry > Date.now()) {
      return shortenedTimeoutMs;
    }
    return timeoutMs;
  }

  private rememberTimeoutFailure(
    storageKey: string | undefined,
    cooldownMs: number,
  ): void {
    if (!storageKey || typeof window === 'undefined') return;

    const existing = Number(window.localStorage.getItem(storageKey));
    const now = Date.now();
    if (existing && existing > now) return;

    window.localStorage.setItem(storageKey, String(now + cooldownMs));
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
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onAnyChange(_callback: ChangeCallback): Unsubscribe {
    return () => {};
  }
}
