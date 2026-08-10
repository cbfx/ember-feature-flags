import BaseFeatureFlagAdapter from './base.js';

class TestFeatureFlagAdapter extends BaseFeatureFlagAdapter {
  flags = new Map();
  /**
   * A Set, not a single slot: the previous single-callback field meant a
   * second subscriber silently evicted the first, and unsubscribing the
   * first would detach the second.
   */
  changeCallbacks = new Set();

  // eslint-disable-next-line ember/classic-decorator-hooks
  init(config) {
    for (const [k, v] of Object.entries(config.flags ?? {})) {
      this.flags.set(k, v);
    }
    return Promise.resolve();
  }
  identify() {
    return Promise.resolve();
  }
  variation(flagName, {
    defaultValue
  } = {}) {
    return this.flags.has(flagName) ? this.flags.get(flagName) : defaultValue;
  }
  onAnyChange(callback) {
    this.changeCallbacks.add(callback);
    return () => {
      this.changeCallbacks.delete(callback);
    };
  }
  notify() {
    for (const cb of this.changeCallbacks) cb();
  }
  setVariation(flagName, value) {
    this.flags.set(flagName, value);
    this.notify();
  }
  reset() {
    this.flags.clear();
    this.notify();
  }
}

export { TestFeatureFlagAdapter as default };
//# sourceMappingURL=test.js.map
