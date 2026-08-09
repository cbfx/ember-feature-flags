/**
 * Copyright IBM Corp. 2020, 2026
 */

import type { TestContext } from '@ember/test-helpers';
import type FeatureFlagsService from '../services/feature-flags.ts';
import type TestFeatureFlagAdapter from '../adapters/test.ts';

interface Hooks {
  beforeEach(fn: (this: TestContext) => void | Promise<void>): void;
  afterEach(fn: (this: TestContext) => void | Promise<void>): void;
}

let currentService: FeatureFlagsService | null = null;

/**
 * Register in QUnit modules alongside `setupApplicationTest(hooks)` /
 * `setupRenderingTest(hooks)`. Initializes the feature-flag service with
 * the test adapter before each test and resets flags after.
 */
export function setupFeatureFlags(hooks: Hooks): void {
  hooks.beforeEach(async function (this: TestContext) {
    currentService = this.owner.lookup(
      'service:feature-flags',
    ) as FeatureFlagsService;
    await currentService.initialize({
      primary: 'test',
      providers: { test: { flags: {} } },
    });
  });

  hooks.afterEach(function () {
    const adapter = currentService?.primary as TestFeatureFlagAdapter | null;
    adapter?.reset();
    currentService = null;
  });
}

/**
 * Set a flag's value for the current test. Must be called after
 * `setupFeatureFlags(hooks)` has run.
 */
export function withVariation(flag: string, value: unknown): void {
  if (!currentService) {
    throw new Error(
      '[feature-flags] withVariation called before setupFeatureFlags',
    );
  }
  const adapter = currentService.primary as TestFeatureFlagAdapter;
  adapter.setVariation(flag, value);
}
