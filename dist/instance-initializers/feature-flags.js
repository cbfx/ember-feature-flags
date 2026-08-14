import { _setService } from '../variation.js';

var featureFlags = {
  name: 'feature-flags',
  initialize(appInstance) {
    _setService(appInstance.lookup('service:feature-flags'));
  }
};

export { featureFlags as default };
//# sourceMappingURL=feature-flags.js.map
