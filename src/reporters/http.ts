import type { DriftReporter, DriftAggregate } from '../drift-reporter';

interface HttpDriftReporterOptions {
  /**
   * URL that receives the POST. Typically an endpoint on your own backend
   * that attaches real credentials server-side and forwards to Datadog,
   * Splunk, an internal telemetry pipeline, etc.
   */
  endpoint: string;

  /**
   * Extra headers merged into the request. Do not put secrets here — this
   * runs in the browser, anything you set is visible to users. Use session
   * cookies (`credentials: 'include'`) or a short-lived bearer minted by
   * your backend if the request needs auth.
   */
  headers?: Record<string, string>;

  /**
   * Passed through to `fetch`. Use `'include'` when your backend uses
   * session cookies.
   */
  credentials?: RequestCredentials;

  /**
   * Optional transform to reshape the payload before sending. Defaults to
   * `{ aggregates }`. Override if your backend expects a different envelope.
   */
  transform?: (aggregates: DriftAggregate[]) => unknown;
}

/**
 * POSTs batched drifts as JSON to an endpoint you control.
 *
 * The addon never touches provider credentials — your backend does. This
 * reporter is provider-agnostic: your endpoint can forward to Datadog,
 * Splunk, an internal Kafka topic, whatever. The request uses
 * `keepalive: true` so batches flushed on page unload still make it out.
 */
export class HttpDriftReporter implements DriftReporter {
  constructor(private options: HttpDriftReporterOptions) {}

  async report(aggregates: DriftAggregate[]): Promise<void> {
    if (aggregates.length === 0) return;

    const payload = this.options.transform
      ? this.options.transform(aggregates)
      : { aggregates };

    try {
      const response = await fetch(this.options.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.options.headers,
        },
        credentials: this.options.credentials,
        body: JSON.stringify(payload),
        // Ensures the request survives page unload flushes.
        keepalive: true,
      });

      if (!response.ok) {
        console.error(
          `[feature-flags] drift reporter HTTP ${response.status}: ${response.statusText}`,
        );
      }
    } catch (err) {
      // Reporter errors must not break the app. Log and move on — the next
      // flush will try again with the freshly accumulated batch.
      console.error('[feature-flags] drift reporter failed:', err);
    }
  }
}
