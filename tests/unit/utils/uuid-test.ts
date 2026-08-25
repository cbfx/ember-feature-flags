import { module, test } from 'qunit';
import { randomId } from 'ember-feature-flags/utils/uuid';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * `crypto.randomUUID` is secure-context only, so a dev server reached over
 * plain `http://` on a LAN address gets `undefined`. Both provider adapters
 * generate an anonymous id during construction, so an unguarded call took flag
 * initialization down entirely rather than degrading.
 */
module('Unit | Utility | randomId', function (hooks) {
  let realCrypto: Crypto;

  hooks.beforeEach(function () {
    realCrypto = globalThis.crypto;
  });

  hooks.afterEach(function () {
    stubCrypto(realCrypto);
  });

  // `globalThis.crypto` is a getter-only property, so plain assignment throws.
  function stubCrypto(value: unknown): void {
    Object.defineProperty(globalThis, 'crypto', {
      value,
      configurable: true,
      writable: true,
    });
  }

  test('it returns a v4 UUID when crypto.randomUUID exists', function (assert) {
    assert.true(UUID_V4.test(randomId()), 'matches the v4 shape');
  });

  test('it falls back to getRandomValues outside a secure context', function (assert) {
    stubCrypto({
      getRandomValues: realCrypto.getRandomValues.bind(realCrypto),
    });

    const id = randomId();
    assert.true(UUID_V4.test(id), 'still produces a valid v4 UUID');
    assert.strictEqual(id[14], '4', 'version nibble is set');
    assert.true('89ab'.includes(id[19] as string), 'variant nibble is set');
  });

  test('it degrades to a usable string with no crypto at all', function (assert) {
    stubCrypto(undefined);

    const id = randomId();
    assert.true(id.startsWith('anon-'), 'uses the non-crypto fallback');
    assert.true(id.length > 10, 'long enough to be distinguishing');
  });

  test('it does not collide across many calls', function (assert) {
    const ids = new Set(Array.from({ length: 1000 }, () => randomId()));
    assert.strictEqual(ids.size, 1000, 'all ids unique');
  });
});
