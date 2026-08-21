/**
 * Copyright IBM Corp. 2020, 2026
 */
import type { TestContext } from '@ember/test-helpers';
export interface FeatureFlagsTestContext extends TestContext {
    withVariation?: (key: string, value?: unknown) => Promise<void>;
}
interface Hooks {
    beforeEach(fn: (this: FeatureFlagsTestContext) => void | Promise<void>): void;
    afterEach(fn: (this: FeatureFlagsTestContext) => void | Promise<void>): void;
}
export declare function setupFeatureFlags(hooks: Hooks): void;
export {};
//# sourceMappingURL=index.d.ts.map