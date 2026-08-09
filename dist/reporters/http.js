/**
 * POSTs batched drifts as JSON to an endpoint you control.
 *
 * The addon never touches provider credentials — your backend does. This
 * reporter is provider-agnostic: your endpoint can forward to Datadog,
 * Splunk, an internal Kafka topic, whatever. The request uses
 * `keepalive: true` so batches flushed on page unload still make it out.
 */
class HttpDriftReporter {
  constructor(options) {
    this.options = options;
  }
  async report(aggregates) {
    if (aggregates.length === 0) return;
    const payload = this.options.transform ? this.options.transform(aggregates) : {
      aggregates
    };
    try {
      const response = await fetch(this.options.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.options.headers
        },
        credentials: this.options.credentials,
        body: JSON.stringify(payload),
        // Ensures the request survives page unload flushes.
        keepalive: true
      });
      if (!response.ok) {
        console.error(`[feature-flags] drift reporter HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      // Reporter errors must not break the app. Log and move on — the next
      // flush will try again with the freshly accumulated batch.
      console.error('[feature-flags] drift reporter failed:', err);
    }
  }
}

export { HttpDriftReporter };
//# sourceMappingURL=http.js.map
