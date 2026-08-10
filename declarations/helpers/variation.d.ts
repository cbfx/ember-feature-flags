import Helper from '@ember/component/helper';
import type FeatureFlagsService from '../services/feature-flags.ts';
import type { VariationOptions } from '../adapters/base.ts';
type RenderableValue = string | number | boolean | null | undefined;
export interface VariationSignature {
    Args: {
        Positional: [flagName: string];
        Named: VariationOptions;
    };
    Return: RenderableValue;
}
export default class VariationHelper extends Helper<VariationSignature> {
    featureFlags: FeatureFlagsService;
    compute([flagName]: [string], options?: VariationOptions): RenderableValue;
}
export {};
//# sourceMappingURL=variation.d.ts.map