import type { DriftReporter, DriftAggregate } from '../drift-reporter';
/**
 * Default drift reporter. Logs each aggregate to `console.warn`.
 *
 * Registered automatically if no reporter is set via
 * `featureFlags.setDriftReporter()` before `initialize()`. Fine for
 * development and for spot-checking drift in staging; swap in a real
 * sink (`HttpDriftReporter`, `SentryDriftReporter`, `PostHogDriftReporter`)
 * for production.
 */
export declare class ConsoleDriftReporter implements DriftReporter {
    report(aggregates: DriftAggregate[]): void;
}
//# sourceMappingURL=console.d.ts.map