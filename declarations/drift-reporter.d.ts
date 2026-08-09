/**
 * Drift detection types and reporter interface.
 *
 * When the feature-flag service has multiple providers configured (a primary
 * plus one or more secondaries), it queries all of them on every flag read.
 * If a secondary's value differs from the primary's, that's drift. Drifts are
 * aggregated per flag with a running count and flushed to a `DriftReporter`
 * periodically, on page unload, or on manual `flushDrift()`.
 *
 * The reporter is pluggable — swap in a different implementation depending on
 * where you want drifts to go (console, HTTP endpoint, Sentry, PostHog, etc).
 * See `ember-feature-flags/reporters` for the built-in implementations.
 */
/**
 * Categorizes what kind of mismatch occurred between primary and secondaries.
 */
export type DriftKind = 
/** Both providers returned a value, but the values differ. */
'value_drift'
/** Primary returned a value; a secondary didn't have the flag. */
 | 'missing_in_secondary'
/** A secondary returned a value; primary didn't have the flag. */
 | 'missing_in_primary';
/**
 * A batched drift record for a single flag. Accumulated in memory by the
 * service between flushes — every additional drift for the same flag bumps
 * `count` and updates `lastSeen` rather than creating a new record.
 */
export interface DriftAggregate {
    /** The flag key that drifted. */
    flag: string;
    /** What kind of drift this represents. */
    kind: DriftKind;
    /** The primary provider's answer at the time drift was recorded. */
    primary: {
        provider: string;
        value: unknown;
    };
    /** Each secondary's answer, keyed by provider name. */
    secondaries: Record<string, unknown>;
    /** How many times this drift has been observed in the current flush window. */
    count: number;
    /** Milliseconds since epoch when this drift was first observed. */
    firstSeen: number;
    /** Milliseconds since epoch when this drift was most recently observed. */
    lastSeen: number;
}
/**
 * The contract every drift reporter implements. The service calls `report()`
 * with a batch of aggregates on each flush; implementations decide what to
 * do with them (log, POST, send to an SDK, etc).
 *
 * `report()` may be sync or async — the service doesn't await it, but errors
 * inside the reporter are the reporter's responsibility to handle.
 */
export interface DriftReporter {
    report(aggregates: DriftAggregate[]): void | Promise<void>;
}
//# sourceMappingURL=drift-reporter.d.ts.map