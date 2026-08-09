/**
 * Copyright IBM Corp. 2020, 2026
 */

let currentService = null;

/**
 * Register in QUnit modules alongside `setupApplicationTest(hooks)` /
 * `setupRenderingTest(hooks)`. Initializes the feature-flag service with
 * the test adapter before each test and resets flags after.
 */
function setupFeatureFlags(hooks) {
  hooks.beforeEach(async function () {
    currentService = this.owner.lookup('service:feature-flags');
    await currentService.initialize({
      primary: 'test',
      providers: {
        test: {
          flags: {}
        }
      }
    });
  });
  hooks.afterEach(function () {
    const adapter = currentService?.primary;
    adapter?.reset();
    currentService = null;
  });
}

/**
 * Set a flag's value for the current test. Must be called after
 * `setupFeatureFlags(hooks)` has run.
 */
function withVariation(flag, value) {
  if (!currentService) {
    throw new Error('[feature-flags] withVariation called before setupFeatureFlags');
  }
  const adapter = currentService.primary;
  adapter.setVariation(flag, value);
}

export { setupFeatureFlags, withVariation };
//# sourceMappingURL=index.js.map
