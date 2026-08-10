import BaseFeatureFlagAdapter, {
  type VariationOptions,
  type ChangeCallback,
  type Unsubscribe,
} from './base.ts';

export interface TestConfig {
  flags?: Record<string, unknown>;
}

export default class TestFeatureFlagAdapter extends BaseFeatureFlagAdapter {
  private flags = new Map<string, unknown>();
  /**
   * A Set, not a single slot: the previous single-callback field meant a
   * second subscriber silently evicted the first, and unsubscribing the
   * first would detach the second.
   */
  private changeCallbacks: Set<ChangeCallback> = new Set();

  // eslint-disable-next-line ember/classic-decorator-hooks
  init(config: TestConfig): Promise<void> {
    for (const [k, v] of Object.entries(config.flags ?? {})) {
      this.flags.set(k, v);
    }
    return Promise.resolve();
  }

  identify(): Promise<void> {
    return Promise.resolve();
  }

  variation<T = unknown>(
    flagName: string,
    { defaultValue }: VariationOptions<T> = {},
  ): T {
    return (
      this.flags.has(flagName) ? this.flags.get(flagName) : defaultValue
    ) as T;
  }

  onAnyChange(callback: ChangeCallback): Unsubscribe {
    this.changeCallbacks.add(callback);
    return () => {
      this.changeCallbacks.delete(callback);
    };
  }

  private notify(): void {
    for (const cb of this.changeCallbacks) cb();
  }

  setVariation(flagName: string, value: unknown): void {
    this.flags.set(flagName, value);
    this.notify();
  }

  reset(): void {
    this.flags.clear();
    this.notify();
  }
}
