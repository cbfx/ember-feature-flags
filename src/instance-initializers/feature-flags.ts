import type ApplicationInstance from '@ember/application/instance';
import { _getService, _setService } from '../variation.ts';

export default {
  name: 'feature-flags',
  initialize(appInstance: ApplicationInstance): void {
    // Parity with ember-launch-darkly, whose `window.__LD__` survives an app
    // boot. In an acceptance test `setupFeatureFlags` has already put a
    // service here; overwriting it would discard the flags the test set.
    if (_getService()) return;
    _setService(appInstance.lookup('service:feature-flags'));
  },
};
