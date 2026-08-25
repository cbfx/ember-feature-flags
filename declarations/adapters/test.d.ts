import BaseFeatureFlagAdapter, { type VariationOptions, type ChangeCallback, type Unsubscribe } from './base.ts';
export interface TestConfig {
    flags?: Record<string, unknown>;
}
export default class TestFeatureFlagAdapter extends BaseFeatureFlagAdapter {
    private flags;
    /**
     * A Set, not a single slot: the previous single-callback field meant a
     * second subscriber silently evicted the first, and unsubscribing the
     * first would detach the second.
     */
    private changeCallbacks;
    init(config: TestConfig): Promise<void>;
    identify(): Promise<void>;
    variation<T = unknown>(flagName: string, { defaultValue }?: VariationOptions<T>): T;
    onAnyChange(callback: ChangeCallback): Unsubscribe;
    private notify;
    setVariation(flagName: string, value: unknown): void;
    reset(): void;
}
//# sourceMappingURL=test.d.ts.map