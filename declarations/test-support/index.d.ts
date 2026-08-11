/**
 * Copyright IBM Corp. 2020, 2026
 */
import type { TestContext } from '@ember/test-helpers';
interface Hooks {
    beforeEach(fn: (this: TestContext) => void | Promise<void>): void;
    afterEach(fn: (this: TestContext) => void | Promise<void>): void;
}
export declare function setupFeatureFlags(hooks: Hooks): void;
declare module '@ember/test-helpers' {
    interface TestContext {
        withVariation?: (key: string, value?: unknown) => Promise<void>;
    }
}
export {};
//# sourceMappingURL=index.d.ts.map