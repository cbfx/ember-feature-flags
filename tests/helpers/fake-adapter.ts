import BaseFeatureFlagAdapter from 'ember-feature-flags/adapters/base';
import type {
  FlagUser,
  VariationOptions,
  ChangeCallback,
  Unsubscribe,
} from 'ember-feature-flags/adapters/base';

export interface FakeAdapterConfig {
  flags?: Record<string, unknown>;
  /** Reject from `init()`, to exercise the broken-secondary path. */
  failInit?: boolean;
  /** Throw from `variation()`, to exercise the failed-read path. */
  failRead?: boolean;
}

/**
 * In-memory adapter used across the unit tests.
 *
 * Deliberately separate from the shipped `adapters/test.ts` so the harness and
 * the code under test aren't the same implementation — otherwise a bug in one
 * hides a bug in the other, and `adapters/test.ts` can't be tested on its own
 * terms.
 *
 * Exposes `subscriberCount` and `shutdownCount` so leak assertions can check
 * real state rather than infer it.
 */
export default class FakeAdapter extends BaseFeatureFlagAdapter<FakeAdapterConfig> {
  flags = new Map<string, unknown>();
  identifyCalls: Array<{ user: FlagUser; traits: Record<string, unknown> }> =
    [];
  shutdownCount = 0;
  failRead = false;

  private callbacks = new Set<ChangeCallback>();

  // eslint-disable-next-line ember/classic-decorator-hooks
  init(config: FakeAdapterConfig): Promise<void> {
    if (config.failInit) {
      return Promise.reject(new Error('fake adapter init failed'));
    }
    this.failRead = Boolean(config.failRead);
    for (const [key, value] of Object.entries(config.flags ?? {})) {
      this.flags.set(key, value);
    }
    return Promise.resolve();
  }

  identify(
    user: FlagUser,
    traits: Record<string, unknown> = {},
  ): Promise<void> {
    this.identifyCalls.push({ user, traits });
    return Promise.resolve();
  }

  variation<T = unknown>(
    flagName: string,
    { defaultValue }: VariationOptions<T> = {},
  ): T {
    if (this.failRead) throw new Error('fake adapter read failed');
    return (
      this.flags.has(flagName) ? this.flags.get(flagName) : defaultValue
    ) as T;
  }

  onAnyChange(callback: ChangeCallback): Unsubscribe {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /** Test hook: change a flag and notify subscribers. */
  setFlag(flagName: string, value: unknown): void {
    this.flags.set(flagName, value);
    for (const cb of this.callbacks) cb();
  }

  /** Live change subscriptions, for leak assertions. */
  get subscriberCount(): number {
    return this.callbacks.size;
  }

  override shutdown(): void {
    this.shutdownCount += 1;
  }
}
