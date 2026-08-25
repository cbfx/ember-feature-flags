import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import FeatureFlagsService from 'ember-feature-flags/services/feature-flags';
import type {
  AdapterRegistry,
  FeatureFlagsConfig,
} from 'ember-feature-flags/services/feature-flags';
import FakeAdapter from '../../helpers/fake-adapter.ts';

class SecondaryAdapter extends FakeAdapter {}

const registry: AdapterRegistry = {
  primary: () => Promise.resolve(FakeAdapter),
  secondary: () => Promise.resolve(SecondaryAdapter),
};

function config(
  overrides: Partial<FeatureFlagsConfig> = {},
): FeatureFlagsConfig {
  return {
    primary: 'primary',
    providers: { primary: {} },
    ...overrides,
  };
}

module('Unit | Service | feature-flags', function (hooks) {
  setupTest(hooks);

  module('initialize', function () {
    test('it throws when no primary is configured', async function (assert) {
      const service = new FeatureFlagsService();

      await assert.rejects(
        service.initialize({} as FeatureFlagsConfig, registry),
        /No primary provider configured/,
        'a config without `primary` is rejected',
      );
    });

    test('it throws a directive error when the primary adapter is unregistered', async function (assert) {
      const service = new FeatureFlagsService();

      try {
        await service.initialize(config({ primary: 'nope' }), registry);
        assert.true(false, 'should have thrown');
      } catch (error) {
        const message = (error as Error).message;
        assert.true(
          message.includes("No adapter registered for primary 'nope'"),
          'names the missing adapter',
        );
        assert.true(
          message.includes('primary, secondary'),
          'lists the adapters that are registered',
        );
      }
    });

    test('it installs the primary adapter and reads through it', async function (assert) {
      const service = new FeatureFlagsService();

      await service.initialize(
        config({ providers: { primary: { flags: { alpha: true } } } }),
        registry,
      );

      assert.true(service.primary instanceof FakeAdapter, 'primary installed');
      assert.true(service.variation('alpha'), 'reads the flag value');
    });

    test('a second initialize is a no-op while a provider is active', async function (assert) {
      const service = new FeatureFlagsService();

      await service.initialize(
        config({ providers: { primary: { flags: { alpha: 1 } } } }),
        registry,
      );
      const first = service.primary;

      await service.initialize(
        config({ providers: { primary: { flags: { alpha: 2 } } } }),
        registry,
      );

      // Parity with ember-launch-darkly: this is what lets a test set flags
      // and then `visit()` without the app's own initialize discarding them.
      assert.strictEqual(service.primary, first, 'adapter is not replaced');
      assert.strictEqual(service.variation('alpha'), 1, 'original value kept');
    });

    test('a secondary that fails to init is quarantined, not fatal', async function (assert) {
      const service = new FeatureFlagsService();

      await service.initialize(
        config({
          secondaries: ['secondary'],
          providers: { primary: {}, secondary: { failInit: true } },
        }),
        registry,
      );

      assert.true(service.primary instanceof FakeAdapter, 'primary still up');
      assert.strictEqual(
        service.secondaries.size,
        0,
        'broken secondary is not registered',
      );
    });
  });

  module('variation', function () {
    test('it falls back to defaultValue for an unknown flag', function (assert) {
      const service = new FeatureFlagsService();

      assert.strictEqual(
        service.variation('nope', { defaultValue: 'fallback' }),
        'fallback',
      );
    });

    test('isEnabled coerces to boolean', async function (assert) {
      const service = new FeatureFlagsService();

      await service.initialize(
        config({ providers: { primary: { flags: { on: 'yes', off: 0 } } } }),
        registry,
      );

      assert.true(service.isEnabled('on'), 'truthy value is true');
      assert.false(service.isEnabled('off'), 'falsy value is false');
      assert.false(service.isEnabled('absent'), 'unknown flag is false');
    });
  });

  module('identify', function () {
    test('it fans out to primary and secondaries', async function (assert) {
      const service = new FeatureFlagsService();

      await service.initialize(
        config({
          secondaries: ['secondary'],
          providers: { primary: {}, secondary: {} },
        }),
        registry,
      );

      await service.identify({ id: 'user-1' }, { org: 'acme' });

      const primary = service.primary as FakeAdapter;
      const secondary = service.secondaries.get('secondary') as FakeAdapter;

      assert.deepEqual(
        primary.identifyCalls[0]?.user,
        { id: 'user-1' },
        'primary received the user',
      );
      assert.deepEqual(
        secondary.identifyCalls[0]?.traits,
        { org: 'acme' },
        'secondary received the traits',
      );
    });
  });
});
