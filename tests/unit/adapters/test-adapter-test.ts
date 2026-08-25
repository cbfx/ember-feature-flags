import { module, test } from 'qunit';
import TestFeatureFlagAdapter from 'ember-feature-flags/adapters/test';

module('Unit | Adapter | test', function () {
  test('it reads seeded flags and falls back to defaultValue', async function (assert) {
    const adapter = new TestFeatureFlagAdapter();
    await adapter.init({ flags: { alpha: true, beta: 'value' } });

    assert.true(adapter.variation('alpha'));
    assert.strictEqual(adapter.variation('beta'), 'value');
    assert.strictEqual(
      adapter.variation('absent', { defaultValue: 'fallback' }),
      'fallback',
    );
  });

  test('a seeded false is returned rather than the default', async function (assert) {
    const adapter = new TestFeatureFlagAdapter();
    await adapter.init({ flags: { alpha: false } });

    // `has()` rather than a truthiness check — otherwise an explicitly
    // disabled flag would silently fall through to the default.
    assert.false(
      adapter.variation('alpha', { defaultValue: true }),
      'an explicit false wins over the default',
    );
  });

  test('it supports multiple independent subscribers', async function (assert) {
    const adapter = new TestFeatureFlagAdapter();
    await adapter.init({});

    let first = 0;
    let second = 0;
    const unsubscribeFirst = adapter.onAnyChange(() => (first += 1));
    adapter.onAnyChange(() => (second += 1));

    adapter.setVariation('alpha', true);
    assert.strictEqual(first, 1, 'first subscriber notified');
    assert.strictEqual(second, 1, 'second subscriber notified');

    // A single-slot callback field would have evicted the first subscriber on
    // registration, and detached the second when this handle was called.
    unsubscribeFirst();
    adapter.setVariation('alpha', false);
    assert.strictEqual(first, 1, 'unsubscribed listener is silent');
    assert.strictEqual(second, 2, 'remaining listener still fires');
  });

  test('reset clears flags and notifies', async function (assert) {
    const adapter = new TestFeatureFlagAdapter();
    await adapter.init({ flags: { alpha: true } });

    let notified = 0;
    adapter.onAnyChange(() => (notified += 1));

    adapter.reset();

    assert.strictEqual(adapter.variation('alpha'), undefined, 'flags cleared');
    assert.strictEqual(notified, 1, 'subscribers notified');
  });
});
