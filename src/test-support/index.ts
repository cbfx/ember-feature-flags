import type FeatureFlagsService from '../services/feature-flags.ts';
import type TestFeatureFlagAdapter from '../adapters/test.ts';

let currentService: FeatureFlagsService | null = null;

export function setupFeatureFlags(hooks: NestedHooks): void {
  hooks.beforeEach(async function () {
    currentService = this.owner.lookup('service:feature-flags');
    await currentService.initialize({
      primary: 'test',
      providers: { test: { flags: {} } },
    });
  });

  hooks.afterEach(function () {
    const testAdapter = currentService?.primary as TestFeatureFlagAdapter;
    testAdapter?.reset();
    currentService = null;
  });
}

export function withVariation(flag: string, value: unknown): void {
  if (!currentService) {
    throw new Error(
      '[feature-flags] withVariation called before setupFeatureFlags',
    );
  }
  const testAdapter = currentService.primary as TestFeatureFlagAdapter;
  testAdapter.setVariation(flag, value);
}
