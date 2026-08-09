import { _setOwner } from '../variation.js';

var featureFlags = {
  name: 'feature-flags',
  initialize(appInstance) {
    _setOwner(appInstance);
  }
};

export { featureFlags as default };
//# sourceMappingURL=feature-flags.js.map
