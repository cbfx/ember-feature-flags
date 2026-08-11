import { settled } from '@ember/test-helpers';
import FeatureFlagsService from '../services/feature-flags.js';
import { defaultAdapters } from '../adapters/index.js';

/**
 * Copyright IBM Corp. 2020, 2026
 */

let currentService = null;
function setupFeatureFlags(hooks) {
  hooks.beforeEach(async function () {
    if (!this.owner) {
      throw new Error('You must call one of the ember-qunit setupTest(), setupRenderingTest() or setupApplicationTest() methods before calling setupFeatureFlags()');
    }
    const owner = this.owner;
    if (!owner.hasRegistration('service:feature-flags')) {
      owner.register('service:feature-flags', FeatureFlagsService);
    }
    currentService = owner.lookup('service:feature-flags');
    const config = owner.resolveRegistration('config:environment');
    const localFlags = Object.keys(config?.launchDarkly?.localFlags ?? {}).reduce((acc, key) => {
      acc[key] = false;
      return acc;
    }, {});
    await currentService.initialize({
      primary: 'test',
      providers: {
        test: {
          flags: localFlags
        }
      }
    }, defaultAdapters);
    this.withVariation = (key, value = true) => {
      const adapter = currentService?.primary;
      if (!adapter || typeof adapter.setVariation !== 'function') {
        throw new Error('Feature flags test adapter is missing. Ensure `setupFeatureFlags` has initialized correctly.');
      }
      adapter.setVariation(key, value);
      return settled();
    };
  });
  hooks.afterEach(async function () {
    const adapter = currentService?.primary;
    adapter?.reset();
    await settled();
    currentService = null;
    delete this.withVariation;
  });
}

export { setupFeatureFlags };
//# sourceMappingURL=index.js.map
