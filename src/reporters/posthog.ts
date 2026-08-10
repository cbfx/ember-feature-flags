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
export class PostHogDriftReporter implements DriftReporter {
  constructor(
    private posthog: PostHogLike,
    private options: PostHogDriftReporterOptions = {},
  ) {
    if (!posthog || typeof posthog.capture !== 'function') {
      throw new Error(
        '[feature-flags] PostHogDriftReporter requires the PostHog instance as its ' +
          "first argument, e.g. `new PostHogDriftReporter(posthog)` after `import posthog from 'posthog-js'`.",
      );
    }
  }

  report(aggregates: DriftAggregate[]): void {
    const eventName = this.options.eventName ?? 'feature_flag_drift';

    for (const agg of aggregates) {
      this.posthog.capture(eventName, {
        flag: agg.flag,
        kind: agg.kind,
        primary_provider: agg.primary.provider,
        primary_value: agg.primary.value,
        secondary_values: agg.secondaries,
        count: agg.count,
        first_seen: agg.firstSeen,
        last_seen: agg.lastSeen,
      });
    }
  }
}
