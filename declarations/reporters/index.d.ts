/**
 * Public entry point for drift reporters. Import from
 * `ember-feature-flags/reporters`.
 *
 * All four reporters implement `DriftReporter`. Pick one (or write your own)
 * and register it in your application route before calling
 * `featureFlags.initialize()`.
 *
 * None of these modules import a third-party SDK: `SentryDriftReporter` and
 * `PostHogDriftReporter` take the SDK as a constructor argument instead. That
 * keeps this barrel importable by consumers who have neither installed.
 */
export { ConsoleDriftReporter } from './console.ts';
export { HttpDriftReporter } from './http.ts';
export { SentryDriftReporter } from './sentry.ts';
export { PostHogDriftReporter } from './posthog.ts';
export type { SentryLike, SentryDriftReporterOptions } from './sentry.ts';
export type { PostHogLike, PostHogDriftReporterOptions } from './posthog.ts';
export type { HttpDriftReporterOptions } from './http.ts';
//# sourceMappingURL=index.d.ts.map