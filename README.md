# ember-feature-flags

A provider-agnostic feature flag system for Ember, with shadow-mode drift detection between multiple providers. Ships with LaunchDarkly and IBM App Configuration adapters and reporters for Console, HTTP, Sentry, and PostHog.

## Compatibility

- Ember.js v6.7 or above
- Embroider or ember-auto-import v2

## Installation

```
pnpm add ember-feature-flags
```

Install the provider SDKs you actually use. They're optional peer dependencies, and nothing in the addon's default module graph references them, so you only install what you need:

```
pnpm add ember-launch-darkly                   # if using the LaunchDarkly adapter
pnpm add ibm-appconfiguration-js-client-sdk    # if using the AppConfiguration adapter
```

`SentryDriftReporter` and `PostHogDriftReporter` are **not** peer dependencies — you pass your app's already-initialized SDK into the constructor, so the addon never imports them. See [Drift reporting](#drift-reporting).

> **Provider adapters are opt-in imports.** `defaultAdapters` contains only the `test` adapter. This isn't an oversight — see [Why provider adapters are opt-in](#why-provider-adapters-are-opt-in).

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
import * as Sentry from '@sentry/browser';
import { defaultAdapters } from 'ember-feature-flags/adapters';
import LaunchDarklyAdapter from 'ember-feature-flags/adapters/launch-darkly';
import { SentryDriftReporter } from 'ember-feature-flags/reporters';
import config from 'ui/config/environment';

const adapters = {
  ...defaultAdapters,
  'launch-darkly': async () => LaunchDarklyAdapter,
};

export default class ApplicationRoute extends Route {
  @service featureFlags;

  async beforeModel() {
    this.featureFlags.setDriftReporter(new SentryDriftReporter(Sentry));
    await this.featureFlags.initialize(config.APP.featureFlags, adapters);
  }
}
```

Every provider you name in `primary` or `secondaries` must have an entry in the registry you pass to `initialize()`. If it doesn't, `initialize()` throws and tells you which names *are* registered.

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

| Adapter | Import from | Requires |
| --- | --- | --- |
| `test` | included in `defaultAdapters` | nothing |
| LaunchDarkly | `ember-feature-flags/adapters/launch-darkly` | `ember-launch-darkly` |
| IBM App Configuration | `ember-feature-flags/adapters/app-config` | `ibm-appconfiguration-js-client-sdk` |

`defaultAdapters` holds only `test`. Add the providers you use:

```ts
import { defaultAdapters } from 'ember-feature-flags/adapters';
import LaunchDarklyAdapter from 'ember-feature-flags/adapters/launch-darkly';
import AppConfigAdapter from 'ember-feature-flags/adapters/app-config';

const adapters = {
  ...defaultAdapters,
  'launch-darkly': async () => LaunchDarklyAdapter,
  'app-config': async () => AppConfigAdapter,
};

await this.featureFlags.initialize(config.APP.featureFlags, adapters);
```

Each adapter's config type lives alongside it:

```ts
import type { LaunchDarklyConfig } from 'ember-feature-flags/adapters/launch-darkly';
import type { AppConfigConfig } from 'ember-feature-flags/adapters/app-config';
```

### Why provider adapters are opt-in

An earlier version put every adapter in `defaultAdapters` and re-exported the adapter classes from the barrel. That made the optional peer dependencies effectively mandatory, and broke consumer builds with:

```
[plugin embroider-resolver] Error: ember-feature-flags is trying to import from
ibm-appconfiguration-js-client-sdk but that is not one of its explicit dependencies
```

Bundlers don't care whether an import is static or dynamic. A lazy `import()` still puts the target module in the graph, which still puts that module's SDK imports in the graph — so Vite's dependency scanner tried to pre-bundle IBM's SDK in apps that only use LaunchDarkly, and the build died before any app code ran. Lazy loaders control *when code runs*, not *what the bundler must resolve*.

The only thing that keeps an uninstalled optional peer out of the graph is not importing the module that needs it. Hence the separate entry points.

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

If your adapter wraps an SDK that not every consumer of *your* app has, keep it in its own module for the same reason described above.

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

Takes your app's Sentry namespace as its first argument. The addon does not import or depend on `@sentry/browser` at all — you already have it, so passing it in is both simpler and keeps `ember-feature-flags/reporters` importable by apps that don't use Sentry.

Your app must have called `Sentry.init(...)` before drifts start flowing.

```ts
import * as Sentry from '@sentry/browser';
import { SentryDriftReporter } from 'ember-feature-flags/reporters';

this.featureFlags.setDriftReporter(
  new SentryDriftReporter(Sentry, {
    level: 'warning',
    category: 'feature-flag-drift',
  })
);
```

#### `PostHogDriftReporter`

Takes your app's PostHog instance as its first argument, for the same reason as `SentryDriftReporter`. Your app must have called `posthog.init(...)` first.

```ts
import posthog from 'posthog-js';
import { PostHogDriftReporter } from 'ember-feature-flags/reporters';

this.featureFlags.setDriftReporter(
  new PostHogDriftReporter(posthog, { eventName: 'feature_flag_drift' })
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

Every `DriftAggregate` is JSON-serializable. Each entry in `secondaries` is `{ kind, value }`, or `{ kind, missing: true }` when that secondary had no value for the flag:

```ts
{
  flag: 'new-checkout-flow',
  kind: 'missing_in_secondary',
  primary: { provider: 'launch-darkly', value: true },
  secondaries: { 'app-config': { kind: 'missing_in_secondary', missing: true } },
  count: 3,
  firstSeen: 1770000000000,
  lastSeen: 1770000012000,
}
```

When several secondaries disagree in different ways, the top-level `kind` is the most significant one (`missing_in_primary` > `missing_in_secondary` > `value_drift`); per-secondary detail stays in `secondaries[name].kind`.

## Migrating between providers

1. Add the new provider as a `secondary`. Ship it. Drift reports tell you where flags disagree.
2. Fix flag definitions and targeting until drift is near zero.
3. Flip `primary` to the new provider, keep the old as a secondary.
4. Once stable, remove the old provider entirely.

Each step is a config change, not a code change.

## Testing

Call `setupFeatureFlags(hooks)` in any module that reads flags. It initializes the service with the `test` provider before each test and resets flags after. No secondaries are configured, so drift detection never runs in tests.

```ts
import {
  setupFeatureFlags,
  withVariation,
} from 'ember-feature-flags/test-support';

module('Acceptance | checkout', function (hooks) {
  setupApplicationTest(hooks);
  setupFeatureFlags(hooks);

  test('shows new flow when flag is on', async function (assert) {
    withVariation('new-checkout-flow', true);
    await visit('/checkout');
    assert.dom('[data-test-new-checkout]').exists();
  });
});
```

`setupFeatureFlags` optionally seeds flags for the whole module, and `withVariations` sets several at once:

```ts
setupFeatureFlags(hooks, { flags: { 'new-nav': true } });

withVariations({ 'new-checkout-flow': true, 'promo-banner': false });
```

Flags reset between tests automatically. `withVariation` throws a descriptive error if `setupFeatureFlags(hooks)` is missing.

## Contributing

See the [Contributing](CONTRIBUTING.md) guide for details.
