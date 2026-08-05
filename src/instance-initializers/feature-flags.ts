import type ApplicationInstance from '@ember/application/instance';
import { _setOwner } from '../variation.ts';

export default {
  name: 'feature-flags',
  initialize(appInstance: ApplicationInstance): void {
    _setOwner(appInstance);
  },
};
