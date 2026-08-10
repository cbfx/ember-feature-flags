/**
 * The slice of `@sentry/browser` this reporter uses.
 *
 * Declared structurally rather than imported so the addon carries no
 * dependency on Sentry at all — `import * as Sentry from '@sentry/browser'`
 * at module scope would force every consumer of
 * `ember-feature-flags/reporters` to have Sentry installed, including the ones
 * who only wanted `ConsoleDriftReporter`.
 *
 * `import * as Sentry from '@sentry/browser'` in your own app satisfies this.
 */

/**
 * Reports drift to Sentry via `captureMessage`.
 *
 * Pass in your app's already-initialized Sentry namespace. The reporter never
 * handles credentials — Sentry's SDK owns its own DSN from your `Sentry.init`
 * call, which must have happened before drifts start flowing.
 *
 *   import * as Sentry from '@sentry/browser';
 *   import { SentryDriftReporter } from 'ember-feature-flags/reporters';
 *
 *   this.featureFlags.setDriftReporter(
 *     new SentryDriftReporter(Sentry, { level: 'warning' }),
 *   );
 *
 * Each aggregate becomes one Sentry event tagged with the flag name, drift
 * kind, and primary provider. Values and counts go in `extra` for debugging.
 */
class SentryDriftReporter {
  constructor(sentry, options = {}) {
    this.sentry = sentry;
    this.options = options;
    if (!sentry || typeof sentry.captureMessage !== 'function') {
      throw new Error('[feature-flags] SentryDriftReporter requires the Sentry namespace as its ' + "first argument, e.g. `new SentryDriftReporter(Sentry)` after `import * as Sentry from '@sentry/browser'`.");
    }
  }
  report(aggregates) {
    const level = this.options.level ?? 'warning';
    const category = this.options.category ?? 'feature-flag-drift';
    for (const agg of aggregates) {
      this.sentry.captureMessage(`Feature flag drift: ${agg.flag}`, {
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
