import { _getService, _setService } from '../variation.js';

var featureFlags = {
  name: 'feature-flags',
  initialize(appInstance) {
    // Parity with ember-launch-darkly, whose `window.__LD__` survives an app
    // boot. In an acceptance test `setupFeatureFlags` has already put a
    // service here; overwriting it would discard the flags the test set.
    if (_getService()) return;
    _setService(appInstance.lookup('service:feature-flags'));
  }
};

export { featureFlags as default };
//# sourceMappingURL=feature-flags.js.map
