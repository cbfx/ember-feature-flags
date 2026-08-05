import posthog from 'posthog-js';
import type { DriftReporter, DriftAggregate } from '../drift-reporter';

interface PostHogDriftReporterOptions {
  /**
   * PostHog event name for each drift. Defaults to `'feature_flag_drift'`.
   * Pick something consistent so you can build a single insight/funnel
   * around it.
   */
  eventName?: string;
}

/**
 * Reports drift to PostHog via `posthog.capture`.
 *
 * Requires `posthog-js` as an optional peer dependency and that your app
 * has already called `posthog.init(...)` before drifts start flowing. The
 * reporter never handles credentials — PostHog's SDK owns its own project
 * key from the consumer's init call.
 *
 * Each aggregate becomes one PostHog event with the flag name, drift kind,
 * primary/secondary values, and count as event properties.
 */
export class PostHogDriftReporter implements DriftReporter {
  constructor(private options: PostHogDriftReporterOptions = {}) {}

  report(aggregates: DriftAggregate[]): void {
    const eventName = this.options.eventName ?? 'feature_flag_drift';

    for (const agg of aggregates) {
      posthog.capture(eventName, {
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
