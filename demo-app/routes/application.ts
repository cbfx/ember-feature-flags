import Route from '@ember/routing/route';
import { service } from '@ember/service';

import type FeatureFlagsService from 'ember-feature-flags/services/feature-flags';

export default class ApplicationRoute extends Route {
  @service declare featureFlags: FeatureFlagsService;

  async beforeModel(): Promise<void> {
    await this.featureFlags.initialize({
      primary: 'test',
      providers: {
        test: {
          flags: {
            'demo-flag': true,
            'demo-string-flag': 'hello from feature flags',
          },
        },
      },
    });
  }
}
