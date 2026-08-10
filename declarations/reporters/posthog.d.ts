import type { DriftReporter, DriftAggregate } from '../drift-reporter.ts';
/**
 * The slice of `posthog-js` this reporter uses.
 *
 * Declared structurally rather than imported so the addon carries no
 * dependency on PostHog at all — see the note in `sentry.ts` for why a
 * module-scope import of an optional peer breaks consumers who don't have it.
 *
 * The default export of `posthog-js` satisfies this.
 */
export interface PostHogLike {
    capture(eventName: string, properties?: Record<string, unknown>): unknown;
}
export interface PostHogDriftReporterOptions {
    /**
     * PostHog event name for each drift. Defaults to `'feature_flag_drift'`.
     * Pick something consistent so you can build a single insight/funnel
     * around it.
     */
    eventName?: string;
}
/**
 * Reports drift to PostHog via `capture`.
 *
 * Pass in your app's already-initialized PostHog instance. The reporter never
 * handles credentials — PostHog's SDK owns its own project key from your
 * `posthog.init` call, which must have happened before drifts start flowing.
 *
 *   import posthog from 'posthog-js';
 *   import { PostHogDriftReporter } from 'ember-feature-flags/reporters';
 *
 *   this.featureFlags.setDriftReporter(new PostHogDriftReporter(posthog));
 *
 * Each aggregate becomes one PostHog event with the flag name, drift kind,
 * primary/secondary values, and count as event properties.
 */
export declare class PostHogDriftReporter implements DriftReporter {
    private posthog;
    private options;
    constructor(posthog: PostHogLike, options?: PostHogDriftReporterOptions);
    report(aggregates: DriftAggregate[]): void;
}
//# sourceMappingURL=posthog.d.ts.map