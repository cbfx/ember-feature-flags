import BaseFeatureFlagAdapter from './base.js';

class TestFeatureFlagAdapter extends BaseFeatureFlagAdapter {
  flags = new Map();
  changeCallback = null;

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
    this.changeCallback = callback;
    return () => {
      this.changeCallback = null;
    };
  }
  setVariation(flagName, value) {
    this.flags.set(flagName, value);
    this.changeCallback?.();
  }
  reset() {
    this.flags.clear();
    this.changeCallback?.();
  }
}

export { TestFeatureFlagAdapter as default };
//# sourceMappingURL=test.js.map
