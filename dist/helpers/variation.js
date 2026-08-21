import Helper from '@ember/component/helper';
import { service } from '@ember/service';
import { g, i } from 'decorator-transforms/runtime-esm';

class VariationHelper extends Helper {
  static {
    g(this.prototype, "featureFlags", [service]);
  }
  #featureFlags = (i(this, "featureFlags"), void 0);
  compute([flagName], options = {}) {
    return this.featureFlags.variation(flagName, options);
  }
}

export { VariationHelper as default };
//# sourceMappingURL=variation.js.map
