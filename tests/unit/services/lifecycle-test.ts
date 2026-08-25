import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import FeatureFlagsService from 'ember-feature-flags/services/feature-flags';
import type { AdapterRegistry } from 'ember-feature-flags/services/feature-flags';
import FakeAdapter from '../../helpers/fake-adapter.ts';

class SecondaryAdapter extends FakeAdapter {}

const registry: AdapterRegistry = {
  primary: () => Promise.resolve(FakeAdapter),
  secondary: () => Promise.resolve(SecondaryAdapter),
};

module('Unit | Service | feature-flags | lifecycle', function (hooks) {
  setupTest(hooks);

  test('it subscribes to adapter changes on initialize', async function (assert) {
    const service = new FeatureFlagsService();

    await service.initialize(
      { primary: 'primary', providers: { primary: {} } },
      registry,
    );

    const adapter = service.primary as FakeAdapter;
    assert.strictEqual(adapter.subscriberCount, 1, 'one subscription held');
  });

  test('willDestroy releases adapter subscriptions', async function (assert) {
    const service = new FeatureFlagsService();

    await service.initialize(
      { primary: 'primary', providers: { primary: {} } },
      registry,
    );
    const adapter = service.primary as FakeAdapter;

    service.willDestroy();
    await Promise.resolve();

    // A discarded unsubscribe handle leaves the adapter bumping a tracked
    // counter on a destroyed service.
    assert.strictEqual(adapter.subscriberCount, 0, 'subscription detached');
  });

  test('willDestroy shuts every adapter down', async function (assert) {
    const service = new FeatureFlagsService();

    await service.initialize(
      {
        primary: 'primary',
        secondaries: ['secondary'],
        providers: { primary: {}, secondary: {} },
      },
      registry,
    );
    const primary = service.primary as FakeAdapter;
    const secondary = service.secondaries.get('secondary') as FakeAdapter;

    service.willDestroy();
    await Promise.resolve();
    await Promise.resolve();

    assert.strictEqual(primary.shutdownCount, 1, 'primary shut down');
    assert.strictEqual(secondary.shutdownCount, 1, 'secondary shut down');
  });

  test('pending drift is flushed on teardown', async function (assert) {
    const service = new FeatureFlagsService();
    let flushed = 0;

    await service.initialize(
      {
        primary: 'primary',
        secondaries: ['secondary'],
        providers: {
          primary: { flags: { a: 1 } },
          secondary: { flags: { a: 2 } },
        },
      },
      registry,
      { onDrift: (aggregates) => void (flushed += aggregates.length) },
    );

    service.variation('a');
    service.willDestroy();
    await Promise.resolve();

    assert.strictEqual(flushed, 1, 'buffered drift is not lost on destroy');
  });
});
