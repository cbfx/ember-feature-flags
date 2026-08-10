import type { DriftReporter, DriftAggregate } from '../drift-reporter.ts';
type SentryLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal';
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
export interface SentryLike {
    captureMessage(message: string, captureContext?: {
        level?: SentryLevel;
        tags?: Record<string, string>;
        extra?: Record<string, unknown>;
    }): unknown;
}
export interface SentryDriftReporterOptions {
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
export declare class SentryDriftReporter implements DriftReporter {
    private sentry;
    private options;
    constructor(sentry: SentryLike, options?: SentryDriftReporterOptions);
    report(aggregates: DriftAggregate[]): void;
}
export {};
//# sourceMappingURL=sentry.d.ts.map