import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, settled } from '@ember/test-helpers';
import type { TestContext } from '@ember/test-helpers';
import variation from 'ember-feature-flags/helpers/variation';
import FeatureFlagsService from 'ember-feature-flags/services/feature-flags';
import type { AdapterRegistry } from 'ember-feature-flags/services/feature-flags';
import FakeAdapter from '../../helpers/fake-adapter.ts';

const registry: AdapterRegistry = {
  primary: () => Promise.resolve(FakeAdapter),
};

interface Context extends TestContext {
  service: FeatureFlagsService;
}

module('Integration | Helper | variation', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(async function (this: Context) {
    this.owner.register('service:feature-flags', FeatureFlagsService);

    // Inside the addon's own suite the package-name import resolves to
    // `declarations/` while the container resolves to `src/`. Same class at
    // runtime, two nominal types.
    this.service = this.owner.lookup(
      'service:feature-flags',
    ) as unknown as FeatureFlagsService;

    await this.service.initialize(
      {
        primary: 'primary',
        providers: { primary: { flags: { alpha: true } } },
      },
      registry,
    );
  });

  test('it renders a flag value', async function (assert) {
    await render(<template>{{variation "alpha"}}</template>);

    assert.dom().hasText('true', 'reads the flag through the service');
  });

  test('it renders the default for an unknown flag', async function (assert) {
    await render(
      <template>{{variation "absent" defaultValue="fallback"}}</template>,
    );

    assert.dom().hasText('fallback');
  });

  test('it re-renders when the adapter reports a change', async function (this: Context, assert) {
    await render(<template>{{variation "beta"}}</template>);
    assert.dom().hasText('', 'starts unset');

    // The adapter's change callback bumps the service's tracked `_revision`,
    // which the helper consumed during compute — so the template invalidates.
    (this.service.primary as FakeAdapter).setFlag('beta', 'now-set');
    await settled();

    assert.dom().hasText('now-set', 'template reflects the new value');
  });
});
