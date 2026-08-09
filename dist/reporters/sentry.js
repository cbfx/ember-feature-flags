import * as Sentry from '@sentry/browser';

/**
 * Reports drift to Sentry via `Sentry.captureMessage`.
 *
 * Requires `@sentry/browser` as an optional peer dependency and that your
 * app has already called `Sentry.init(...)` before drifts start flowing.
 * The reporter never handles credentials — Sentry's SDK owns its own DSN
 * from the consumer's init call.
 *
 * Each aggregate becomes one Sentry event tagged with the flag name,
 * drift kind, and primary provider. Values and counts go in `extra` for
 * debugging.
 */
class SentryDriftReporter {
  constructor(options = {}) {
    this.options = options;
  }
  report(aggregates) {
    const level = this.options.level ?? 'warning';
    const category = this.options.category ?? 'feature-flag-drift';
    for (const agg of aggregates) {
      Sentry.captureMessage(`Feature flag drift: ${agg.flag}`, {
        level,
        tags: {
          category,
          flag: agg.flag,
          kind: agg.kind,
          primary_provider: agg.primary.provider
        },
        extra: {
          primary_value: agg.primary.value,
          secondary_values: agg.secondaries,
          count: agg.count,
          first_seen: agg.firstSeen,
          last_seen: agg.lastSeen
        }
      });
    }
  }
}

export { SentryDriftReporter };
//# sourceMappingURL=sentry.js.map
