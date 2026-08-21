/**
 * Default drift reporter. Logs each aggregate to `console.warn`.
 *
 * Registered automatically if no reporter is set via
 * `featureFlags.setDriftReporter()` before `initialize()`. Fine for
 * development and for spot-checking drift in staging; swap in a real
 * sink (`HttpDriftReporter`, `SentryDriftReporter`, `PostHogDriftReporter`)
 * for production.
 */
class ConsoleDriftReporter {
  report(aggregates) {
    for (const agg of aggregates) {
      console.warn('[feature-flags] drift:', agg);
    }
  }
}

export { ConsoleDriftReporter };
//# sourceMappingURL=console.js.map
