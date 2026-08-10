/**
 * Copyright IBM Corp. 2020, 2026
 */
import type { TestContext } from '@ember/test-helpers';
interface Hooks {
    beforeEach(fn: (this: TestContext) => void | Promise<void>): void;
    afterEach(fn: (this: TestContext) => void | Promise<void>): void;
}
export interface SetupFeatureFlagsOptions {
    /** Flags to seed before each test. Defaults to none. */
    flags?: Record<string, unknown>;
}
/**
 * Register in QUnit modules alongside `setupApplicationTest(hooks)` /
 * `setupRenderingTest(hooks)`. Initializes the feature-flag service with
 * the test adapter before each test and resets flags after.
 *
 *   module('Acceptance | checkout', function (hooks) {
 *     setupApplicationTest(hooks);
 *     setupFeatureFlags(hooks);
 *   });
 *
 * Secondaries and drift detection are never configured here, so tests only
 * ever exercise the primary.
 */
export declare function setupFeatureFlags(hooks: Hooks, options?: SetupFeatureFlagsOptions): void;
/**
 * Set a flag's value for the current test. Must be called after
 * `setupFeatureFlags(hooks)` has run.
 */
export declare function withVariation(flag: string, value: unknown): void;
/**
 * Set several flags at once.
 */
export declare function withVariations(flags: Record<string, unknown>): void;
export {};
//# sourceMappingURL=index.d.ts.map