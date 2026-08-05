# ember-feature-flags

A provider-agnostic feature flag system for Ember, with shadow-mode drift detection between multiple providers. Currently supports LaunchDarkly and IBM AppConfig.

## Compatibility

- Ember.js v6.7 or above
- Embroider or ember-auto-import v2

## Installation

```
pnpm add ember-feature-flags
```

## Why

Run one feature-flag provider as your primary source of truth, and one or more secondary providers in parallel. If their values disagree, drift is logged and reported — no user-facing impact. Flip which provider is primary via config when you're ready to migrate.

## API parity with LaunchDarkly

The public surface intentionally mirrors `ember-launch-darkly`'s API so migration from direct LD usage is mostly a find-and-replace.

| `ember-launch-darkly`                             | This addon                                        |
| ------------------------------------------------- | ------------------------------------------------- |
| `import { variation } from 'ember-launch-darkly'` | `import { variation } from 'ember-feature-flags'`  |
| `{{variation "my-flag"}}`                         | `{{variation "my-flag"}}` (identical)             |
| `initialize(clientSideId, user, options)`         | `featureFlags.initialize()`                       |
| `identify(user)`                                  | `featureFlags.identify(user)`                     |

Differences:

- **No `initialize()` args at the call site.** The service reads config from your app's config and initializes itself.
- **Identify takes a normalized user shape.** `{ id, name?, email? }` — the adapter translates `id` to the provider's identifier (LD's `key`, AppConfig's user context).
- **`isEnabled(flag)`** is provided as a boolean convenience.

## Usage

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
    'app-config':    { collectionId: '...', environmentId: '...' },
  },
  drift: {
    enabled: true,
    sampleRate: 1.0,
    onDrift: 'log',
  },
},
```

The `primary` adapter's value is what the app sees. `secondaries` are queried in parallel; mismatches are logged as drift.

## Migrating between providers

1. Add the new provider as a `secondary`. Ship it. Drift dashboard tells you where flags disagree.
2. Fix flag definitions and targeting until drift is near zero.
3. Flip `primary` to the new provider, keep the old as a secondary.
4. Once stable, remove the old provider entirely.

Each step is a config change, not a code change.

## Testing

Tests use the `test` provider automatically. To control flags in a test:

```ts
import { withVariation } from 'ember-feature-flags/test-support';

test('shows new flow when flag is on', async function (assert) {
  withVariation('new-checkout-flow', true);
  await visit('/checkout');
  assert.dom('[data-test-new-checkout]').exists();
});
```

Flags reset between tests automatically.

## Adding a new provider

1. Create `src/adapters/your-provider.ts` extending `BaseFeatureFlagAdapter`.
2. Implement `init`, `identify`, `variation`, `onAnyChange`, and optionally `shutdown`.
3. Register it in `loadAdapter()` in `src/services/feature-flags.ts`.

## Contributing

See the [Contributing](CONTRIBUTING.md) guide for details.

## License

This project is licensed under the [MIT License](LICENSE.md).
