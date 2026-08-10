/**
 * Copyright IBM Corp. 2020, 2026
 */

import type { TestContext } from '@ember/test-helpers';
import type FeatureFlagsService from '../services/feature-flags.ts';
import type TestFeatureFlagAdapter from '../adapters/test.ts';
import { defaultAdapters } from '../adapters/index.ts';

interface Hooks {
  beforeEach(fn: (this: TestContext) => void | Promise<void>): void;
  afterEach(fn: (this: TestContext) => void | Promise<void>): void;
}

export interface SetupFeatureFlagsOptions {
  /** Flags to seed before each test. Defaults to none. */
  flags?: Record<string, unknown>;
}

let currentService: FeatureFlagsService | null = null;

function testAdapter(): TestFeatureFlagAdapter {
  if (!currentService) {
    throw new Error(
      '[feature-flags] No active test service. Call `setupFeatureFlags(hooks)` in ' +
        'your module, alongside setupRenderingTest/setupApplicationTest.',
    );
  }

  const adapter = currentService.primary as TestFeatureFlagAdapter | null;

  // A test that re-initializes with a real provider replaces `primary`, and
  // the previous code then called `.setVariation` / `.reset` on whatever was
  // there and threw an opaque "not a function" TypeError.
  if (!adapter || typeof adapter.setVariation !== 'function') {
    throw new Error(
      '[feature-flags] The primary adapter is not the test adapter. Something in ' +
        'this test re-initialized the service with a different provider, so test ' +
        'flag helpers no longer apply.',
    );
  }

  return adapter;
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
export function setupFeatureFlags(
  hooks: Hooks,
  options: SetupFeatureFlagsOptions = {},
): void {
  hooks.beforeEach(async function (this: TestContext) {
    currentService = this.owner.lookup('service:feature-flags');

    await currentService.initialize(
      {
        primary: 'test',
        providers: { test: { flags: options.flags ?? {} } },
      },
      defaultAdapters,
    );
  });

  hooks.afterEach(function () {
    const adapter = currentService?.primary as TestFeatureFlagAdapter | null;
    if (adapter && typeof adapter.reset === 'function') {
      adapter.reset();
    }
    currentService = null;
  });
}

/**
 * Set a flag's value for the current test. Must be called after
 * `setupFeatureFlags(hooks)` has run.
 */
export function withVariation(flag: string, value: unknown): void {
  testAdapter().setVariation(flag, value);
}

/**
 * Set several flags at once.
 */
export function withVariations(flags: Record<string, unknown>): void {
  const adapter = testAdapter();
  for (const [flag, value] of Object.entries(flags)) {
    adapter.setVariation(flag, value);
  }
}
