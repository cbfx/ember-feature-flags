/**
 * Copyright IBM Corp. 2020, 2026
 */

import { settled } from '@ember/test-helpers';
import type { TestContext } from '@ember/test-helpers';
import FeatureFlagsService from '../services/feature-flags.ts';
import type TestFeatureFlagAdapter from '../adapters/test.ts';
import { defaultAdapters } from '../adapters/index.ts';

export interface FeatureFlagsTestContext extends TestContext {
  withVariation?: (key: string, value?: unknown) => Promise<void>;
}

interface Hooks {
  beforeEach(fn: (this: FeatureFlagsTestContext) => void | Promise<void>): void;
  afterEach(fn: (this: FeatureFlagsTestContext) => void | Promise<void>): void;
}

let currentService: FeatureFlagsService | null = null;

export function setupFeatureFlags(hooks: Hooks): void {
  hooks.beforeEach(async function (this: FeatureFlagsTestContext) {
    if (!this.owner) {
      throw new Error(
        'You must call one of the ember-qunit setupTest(), setupRenderingTest() or setupApplicationTest() methods before calling setupFeatureFlags()',
      );
    }

    const owner = this.owner as typeof this.owner & {
      hasRegistration(fullName: string): boolean;
      resolveRegistration(fullName: string): unknown;
    };

    if (!owner.hasRegistration('service:feature-flags')) {
      owner.register('service:feature-flags', FeatureFlagsService);
    }

    currentService = owner.lookup(
      'service:feature-flags',
    ) as FeatureFlagsService;

    const config = owner.resolveRegistration('config:environment') as
      { launchDarkly?: { localFlags?: Record<string, unknown> } } | undefined;

    const localFlags = Object.keys(
      config?.launchDarkly?.localFlags ?? {},
    ).reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = false;
      return acc;
    }, {});

    await currentService.initialize(
      {
        primary: 'test',
        providers: { test: { flags: localFlags } },
      },
      defaultAdapters,
    );

    this.withVariation = (key: string, value: unknown = true) => {
      const adapter = currentService?.primary as TestFeatureFlagAdapter | null;
      if (!adapter || typeof adapter.setVariation !== 'function') {
        throw new Error(
          'Feature flags test adapter is missing. Ensure `setupFeatureFlags` has initialized correctly.',
        );
      }
      adapter.setVariation(key, value);
      return settled();
    };
  });

  hooks.afterEach(async function (this: FeatureFlagsTestContext) {
    const adapter = currentService?.primary as TestFeatureFlagAdapter | null;
    adapter?.reset();
    await settled();
    currentService = null;
    delete this.withVariation;
  });
}
