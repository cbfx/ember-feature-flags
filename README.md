# ember-feature-flags

A provider-agnostic feature flag system for Ember, with shadow-mode drift detection between multiple providers. Ships with LaunchDarkly and IBM App Configuration adapters and reporters for Console, HTTP, Sentry, and PostHog.

## Compatibility

- Ember.js v6.7 or above
- Embroider or ember-auto-import v2

## Installation

```
pnpm add ember-feature-flags
```

Install any provider SDKs you use (declared as optional peer deps):

```
pnpm add ember-launch-darkly              # if using LaunchDarkly
pnpm add ibm-appconfiguration-js-client-sdk   # if using AppConfiguration
pnpm add @sentry/browser                  # if using SentryDriftReporter
pnpm add posthog-js                       # if using PostHogDriftReporter
```

## Why

Run one feature-flag provider as your primary source of truth, and one or more secondary providers in parallel. If their values disagree, drift is batched and reported — no user-facing impact. Flip which provider is primary via config when you're ready to migrate.

## API parity with LaunchDarkly

The public surface intentionally mirrors `ember-launch-darkly`'s API so migration from direct LD usage is mostly a find-and-replace.

| `ember-launch-darkly`                             | This addon                                        |
| ------------------------------------------------- | ------------------------------------------------- |
| `import { variation } from 'ember-launch-darkly'` | `import { variation } from 'ember-feature-flags'` |
| `{{variation "my-flag"}}`                         | `{{variation "my-flag"}}` (identical)             |
| `initialize(clientSideId, user, options)`         | `featureFlags.initialize(config, adapters)`       |
| `identify(user)`                                  | `featureFlags.identify(user)`                     |

Differences:

- **`initialize()` takes config and an adapter registry.** The registry tells the service which adapters are available; consumers spread `defaultAdapters` and optionally add their own.
- **Identify takes a normalized user shape.** `{ id, name?, email? }` — the adapter translates `id` to the provider's identifier (LD's `key`, AppConfig's user context).
- **`isEnabled(flag)`** is provided as a boolean convenience.

## Usage

### Wire up the service

In your application route, register a drift reporter (optional) and initialize with your config plus the adapter registry:

```ts
// app/routes/application.js
import { service } from '@ember/service';
import { defaultAdapters } from 'ember-feature-flags/adapters';
import { SentryDriftReporter } from 'ember-feature-flags/reporters';
import config from 'ui/config/environment';

export default class ApplicationRoute extends Route {
  @service featureFlags;

  async beforeModel() {
    this.featureFlags.setDriftReporter(new SentryDriftReporter());
    await this.featureFlags.initialize(config.APP.featureFlags, defaultAdapters);
  }
}
```

### In templates

```hbs
{{#if (variation "new-checkout-flow")}}
  <NewCheckout />
{{else}}
  <LegacyCheckout />
{{/if}}
```

The `variation` helper is reactive — templates re-render when a flag changes.

### In components

```ts
import { service } from '@ember/service';
import type FeatureFlagsService from 'ember-feature-flags/services/feature-flags';

export default class CheckoutButton extends Component {
  @service declare featureFlags: FeatureFlagsService;

  get showNewCheckout() {
    return this.featureFlags.isEnabled('new-checkout-flow');
  }
}
```

### In routes and utilities

```ts
import { variation } from 'ember-feature-flags';

beforeModel() {
  if (variation('require-new-onboarding')) {
    this.router.transitionTo('onboarding.v2');
  }
}
```

`variation()` from the barrel export is not reactive — reads at call time. Use the service or template helper for anything that needs to re-render.

## Configuration

```js
FEATURE_FLAGS: {
  primary: 'launch-darkly',
  secondaries: ['app-config'],
  providers: {
    'launch-darkly': { clientSideId: '...', mode: 'remote', localFlags: {} },
    'app-config':    { region: '...', guid: '...', apikey: '...', collectionId: '...', environmentId: '...' },
  },
  drift: {
    enabled: true,
    flushIntervalMs: 30_000,
  },
},
```

The `primary` adapter's value is what the app sees. `secondaries` are queried in parallel; mismatches are batched and reported as drift.

### Typed config blocks

Each adapter exports its config type. Use `satisfies` for compile-time validation:

```ts
import type { LaunchDarklyConfig } from 'ember-feature-flags/adapters/launch-darkly';

const featureFlagsConfig = {
  primary: 'launch-darkly',
  providers: {
    'launch-darkly': { clientSideId: '...' } satisfies LaunchDarklyConfig,
  },
};
```

## Adapters

### Built-in adapters

`defaultAdapters` includes `launch-darkly`, `app-config`, and `test`. Import and pass to `initialize()`:

```ts
import { defaultAdapters } from 'ember-feature-flags/adapters';

await this.featureFlags.initialize(config.APP.featureFlags, defaultAdapters);
```

### Custom adapters

Extend `BaseFeatureFlagAdapter` and register it alongside the defaults:

```ts
// my-app/lib/internal-adapter.ts
import { BaseFeatureFlagAdapter } from 'ember-feature-flags';

export default class InternalAdapter extends BaseFeatureFlagAdapter {
  async init(config) { /* ... */ }
  async identify(user) { /* ... */ }
  variation(flagName, options) { /* ... */ }
  onAnyChange(callback) { /* ... */ }
}
```

Register with a lazy loader:

```ts
import { defaultAdapters } from 'ember-feature-flags/adapters';
import InternalAdapter from 'my-app/lib/internal-adapter';

const adapters = {
  ...defaultAdapters,
  'internal-tool': async () => InternalAdapter,
};

await this.featureFlags.initialize(config.APP.featureFlags, adapters);
```

## Drift reporting

When a secondary's value differs from the primary's, the service records a drift event. Drifts are aggregated per flag (with a `count`) and flushed to a reporter on a periodic interval, on page unload, or on demand.

The addon ships several reporters. You pick one in your application route.

### Built-in reporters

Import from `ember-feature-flags/reporters`.

#### `ConsoleDriftReporter`

Default if no reporter is registered. Logs to `console.warn`.

```ts
import { ConsoleDriftReporter } from 'ember-feature-flags/reporters';

this.featureFlags.setDriftReporter(new ConsoleDriftReporter());
```

#### `HttpDriftReporter`

POSTs the batched aggregates as JSON to an endpoint you control. Your backend attaches any real credentials server-side and forwards to Datadog, Splunk, or wherever. The client never handles secrets.

```ts
import { HttpDriftReporter } from 'ember-feature-flags/reporters';

this.featureFlags.setDriftReporter(
  new HttpDriftReporter({
    endpoint: '/api/telemetry/flag-drift',
    headers: { 'X-Client': 'ui-app' },
    credentials: 'include',
  })
);
```

#### `SentryDriftReporter`

Uses your app's already-initialized `@sentry/browser` singleton. Requires `@sentry/browser` as an optional peer dependency and that your app has called `Sentry.init(...)` before drifts start flowing.

```ts
import { SentryDriftReporter } from 'ember-feature-flags/reporters';

this.featureFlags.setDriftReporter(
  new SentryDriftReporter({
    level: 'warning',
    category: 'feature-flag-drift',
  })
);
```

#### `PostHogDriftReporter`

Uses your app's already-initialized `posthog-js` singleton. Requires `posthog-js` as an optional peer dependency.

```ts
import { PostHogDriftReporter } from 'ember-feature-flags/reporters';

this.featureFlags.setDriftReporter(
  new PostHogDriftReporter({ eventName: 'feature_flag_drift' })
);
```

### Reporting to multiple sinks

If you want drift sent to both Sentry and PostHog (or any combination), write a small reporter in your app that fans out to both. The addon deliberately does not ship a compound reporter — you own that composition.

### Custom reporters

Implement the `DriftReporter` interface for anything else:

```ts
import type { DriftReporter, DriftAggregate } from 'ember-feature-flags';

export class MyReporter implements DriftReporter {
  report(aggregates: DriftAggregate[]): void {
    // ship the batch wherever
  }
}
```

## Migrating between providers

1. Add the new provider as a `secondary`. Ship it. Drift reports tell you where flags disagree.
2. Fix flag definitions and targeting until drift is near zero.
3. Flip `primary` to the new provider, keep the old as a secondary.
4. Once stable, remove the old provider entirely.

Each step is a config change, not a code change.

## Testing

Tests use the `test` provider automatically. Secondaries and drift detection are disabled in tests — only the primary is exercised. To control flags in a test:

```ts
import { withVariation } from 'ember-feature-flags/test-support';

test('shows new flow when flag is on', async function (assert) {
  withVariation('new-checkout-flow', true);
  await visit('/checkout');
  assert.dom('[data-test-new-checkout]').exists();
});
```

Flags reset between tests automatically.

## Contributing

See the [Contributing](CONTRIBUTING.md) guide for details.

## License

This project is licensed under the [MIT License](LICENSE.md).
