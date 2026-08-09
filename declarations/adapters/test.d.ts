import BaseFeatureFlagAdapter, { type VariationOptions, type ChangeCallback, type Unsubscribe } from './base.ts';
export interface TestConfig {
    flags?: Record<string, unknown>;
}
export default class TestFeatureFlagAdapter extends BaseFeatureFlagAdapter {
    private flags;
    private changeCallback;
    init(config: TestConfig): Promise<void>;
    identify(): Promise<void>;
    variation<T = unknown>(flagName: string, { defaultValue }?: VariationOptions<T>): T;
    onAnyChange(callback: ChangeCallback): Unsubscribe;
    setVariation(flagName: string, value: unknown): void;
    reset(): void;
}
//# sourceMappingURL=test.d.ts.map