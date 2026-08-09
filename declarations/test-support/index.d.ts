/**
 * Copyright IBM Corp. 2020, 2026
 */
import type { TestContext } from '@ember/test-helpers';
interface Hooks {
    beforeEach(fn: (this: TestContext) => void | Promise<void>): void;
    afterEach(fn: (this: TestContext) => void | Promise<void>): void;
}
/**
 * Register in QUnit modules alongside `setupApplicationTest(hooks)` /
 * `setupRenderingTest(hooks)`. Initializes the feature-flag service with
 * the test adapter before each test and resets flags after.
 */
export declare function setupFeatureFlags(hooks: Hooks): void;
/**
 * Set a flag's value for the current test. Must be called after
 * `setupFeatureFlags(hooks)` has run.
 */
export declare function withVariation(flag: string, value: unknown): void;
export {};
//# sourceMappingURL=index.d.ts.map