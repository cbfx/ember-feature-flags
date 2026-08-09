import type { DriftReporter, DriftAggregate } from '../drift-reporter';
type SentryLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal';
interface SentryDriftReporterOptions {
    /**
     * Sentry severity for each drift event. Defaults to `'warning'` — drift is
     * a signal that flag definitions disagree, not that the app is broken.
     */
    level?: SentryLevel;
    /**
     * Tag applied to each event's `category` field for filtering in Sentry.
     * Defaults to `'feature-flag-drift'`.
     */
    category?: string;
}
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
export declare class SentryDriftReporter implements DriftReporter {
    private options;
    constructor(options?: SentryDriftReporterOptions);
    report(aggregates: DriftAggregate[]): void;
}
export {};
//# sourceMappingURL=sentry.d.ts.map