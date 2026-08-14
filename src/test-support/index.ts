/**
 * Copyright IBM Corp. 2020, 2026
 */

import { settled } from '@ember/test-helpers';
import type { TestContext } from '@ember/test-helpers';
import Context, {
  setCurrentContext,
  getCurrentContext,
} from 'ember-launch-darkly/-sdk/context';
import FeatureFlagsService from '../services/feature-flags.ts';
import LaunchDarklyAdapter from '../adapters/launch-darkly.ts';
import { _setService } from '../variation.ts';

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

    currentService = owner.lookup('service:feature-flags');
    _setService(currentService);

    const config = owner.resolveRegistration('config:environment') as
      { launchDarkly?: { localFlags?: Record<string, unknown> } } | undefined;

    // Every flag the app declares starts `false`, matching
    // ember-launch-darkly's baseline.
    const localFlags = Object.keys(
      config?.launchDarkly?.localFlags ?? {},
    ).reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = false;
      return acc;
    }, {});

    // Build ELD's context directly and set it current, exactly as
    // `setupLaunchDarkly` does. The LaunchDarkly adapter reads through ELD's
    // `variation()`, so this is the same code path the app uses — no fake
    // provider, no second implementation to keep in sync.
    setCurrentContext(new Context({ flags: localFlags }));

    // Point the service at the LaunchDarkly adapter so `variation()` and the
    // `{{variation}}` helper resolve through it. ELD's `initialize()`
    // early-returns because the context above already exists, so this does
    // not touch the network.
    await currentService.initialize(
      {
        primary: 'launch-darkly',
        providers: {
          'launch-darkly': {
            clientSideId: 'test',
            mode: 'local',
            localFlags,
          },
        },
      },
      { 'launch-darkly': () => Promise.resolve(LaunchDarklyAdapter) },
    );

    this.withVariation = (key: string, value: unknown = true) => {
      const context = getCurrentContext();
      if (!context) {
        throw new Error(
          'LaunchDarkly context is missing. Ensure `setupFeatureFlags` has initialized correctly.',
        );
      }
      context.set(key, value);
      return settled();
    };
  });

  hooks.afterEach(async function (this: FeatureFlagsTestContext) {
    const context = getCurrentContext();
    await context?.destroy();
    await settled();
    currentService = null;
    _setService(null);
    delete this.withVariation;
  });
}
