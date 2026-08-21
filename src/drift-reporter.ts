/**
 * Drift detection types and reporter interface.
 *
 * When the feature-flag service has multiple providers configured (a primary
 * plus one or more secondaries), it queries all of them on every flag read.
 * If a secondary's value differs from the primary's, that's drift. Drifts are
 * aggregated per flag with a running count and flushed to a `DriftReporter`
 * periodically, on page hide, or on manual `flushDrift()`.
 *
 * The reporter is pluggable — swap in a different implementation depending on
 * where you want drifts to go (console, HTTP endpoint, Sentry, PostHog, etc).
 * See `ember-feature-flags/reporters` for the built-in implementations.
 *
 * Everything in `DriftAggregate` is JSON-serializable so reporters can
 * `JSON.stringify` a batch without silently dropping fields.
 */

/**
 * Categorizes what kind of mismatch occurred between primary and secondaries.
 */
export type DriftKind =
  /** Both providers returned a value, but the values differ. */
  | 'value_drift'
  /** Primary returned a value; a secondary didn't have the flag. */
  | 'missing_in_secondary'
  /** A secondary returned a value; primary didn't have the flag. */
  | 'missing_in_primary';

/**
 * One secondary provider's answer for a drifting flag.
 *
 * `missing` and `value` are mutually exclusive: when the secondary had no
 * value for the flag, `missing` is `true` and `value` is absent. This is
 * deliberately a plain object rather than a sentinel value so the whole
 * aggregate survives `JSON.stringify`.
 */
export interface DriftSecondaryValue {
  /** The secondary's value. Absent when `missing` is `true`. */
  value?: unknown;
  /** `true` when this secondary had no value for the flag. */
  missing?: boolean;
  /** How this secondary's answer differed from the primary's. */
  kind: DriftKind;
}

/**
 * A batched drift record for a single flag. Accumulated in memory by the
 * service between flushes — every additional drift for the same flag bumps
 * `count` and updates `lastSeen` rather than creating a new record.
 */
export interface DriftAggregate {
  /** The flag key that drifted. */
  flag: string;
  /**
   * Summary of the drift across all secondaries. When secondaries disagree
   * in different ways, the most significant kind wins:
   * `missing_in_primary` > `missing_in_secondary` > `value_drift`.
   * Per-secondary detail is in `secondaries[name].kind`.
   */
  kind: DriftKind;
  /** The primary provider's answer at the time drift was recorded. */
  primary: {
    provider: string;
    value: unknown;
  };
  /** Each secondary's answer, keyed by provider name. */
  secondaries: Record<string, DriftSecondaryValue>;
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
 * `report()` may be sync or async — the service doesn't await it, but it does
 * attach a `.catch()` so a rejected reporter can't produce an unhandled
 * rejection.
 */
export interface DriftReporter {
  report(aggregates: DriftAggregate[]): void | Promise<void>;
}
