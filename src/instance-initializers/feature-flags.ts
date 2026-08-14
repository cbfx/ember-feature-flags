import type ApplicationInstance from '@ember/application/instance';
import { _setService } from '../variation.ts';

export default {
  name: 'feature-flags',
  initialize(appInstance: ApplicationInstance): void {
    _setService(appInstance.lookup('service:feature-flags'));
  },
};
