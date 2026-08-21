import BaseFeatureFlagAdapter, {
  type FlagUser,
  type VariationOptions,
  type ChangeCallback,
  type Unsubscribe,
} from './base.ts';
import { randomId } from '../utils/uuid.ts';

/**
 * Config shape for the IBM App Configuration adapter, matching what
 * the host's `FEATURE_FLAGS.providers['app-config']` block sets.
 *
 * Consumers can use this with `satisfies` to strongly-type their config
 * block. The adapter itself accepts `Record<string, unknown>` and narrows
 * to this shape at runtime inside `init()`.
 *
 * The API key must be the encrypted variant produced per IBM's
 * README_APIKEY_ENCRYPTION guide — never a plain key in browser code.
 */
export interface AppConfigConfig {
  /** Region where the App Configuration service instance is created (e.g. `us-south`). */
  region: string;
  /** Instance GUID from the App Configuration dashboard's service credentials. */
  guid: string;
  /** Encrypted client-SDK API key. Never use a plain-text key in the browser. */
  apikey: string;
  /** Collection ID defined in the App Configuration service. */
  collectionId: string;
  /** Environment ID defined in the App Configuration service. */
  environmentId: string;
  /** Fallback flag values used when the service is unreachable and no cache exists. */
  localFlags?: Record<string, unknown>;
}

/**
 * Minimal shape of what we use off IBM's `AppConfiguration` client. Kept
 * local so we don't force IBM's types on consumers who use a different
 * provider.
 */
interface AppConfigClient {
  init(region: string, guid: string, apikey: string): void;
  setContext(collectionId: string, environmentId: string): Promise<void>;
  getFeature(featureId: string): {
    getCurrentValue(
      entityId: string,
      entityAttributes?: Record<string, unknown>,
    ): unknown;
  };
  emitter: {
    on(event: string, fn: (...args: unknown[]) => void): unknown;
  };
}

/**
 * IBM Cloud App Configuration adapter.
 *
 * Wraps `ibm-appconfiguration-js-client-sdk` — declared as an optional peer
 * dependency so consumers who don't use App Configuration don't need it.
 *
 * Provider quirks worth knowing:
 *  - Every read requires an `entityId`; anonymous users get a per-session
 *    UUID, real users get their `FlagUser.id` after `identify()`.
 *  - `getFeature()` throws if the flag doesn't exist. We catch and return
 *    `undefined` so the service's drift detection treats it as
 *    `missing_in_secondary`.
 *  - Change events come off the client's `emitter`, not the client itself.
 */
export default class AppConfigAdapter extends BaseFeatureFlagAdapter<AppConfigConfig> {
  private client: AppConfigClient | null = null;
  private entityId: string = randomId();
  private entityAttributes: Record<string, unknown> = {};
  private localFlags: Record<string, unknown> = {};
  private changeCallbacks: Set<ChangeCallback> = new Set();

  // eslint-disable-next-line ember/classic-decorator-hooks
  async init(config: AppConfigConfig): Promise<void> {
    this.localFlags = config.localFlags ?? {};

    // Dynamic import so consumers who don't use App Configuration don't
    // pay the bundle cost of loading IBM's SDK.
    const { default: AppConfiguration } =
      await import('ibm-appconfiguration-js-client-sdk');

    const client = AppConfiguration.getInstance();
    client.init(config.region, config.guid, config.apikey);
    await client.setContext(config.collectionId, config.environmentId);

    this.client = client;

    // App Configuration SDK emits 'configurationUpdate' events on the
    // emitter when flag definitions change on the server.
    client.emitter.on('configurationUpdate', () => {
      for (const cb of this.changeCallbacks) cb();
    });
  }

  async identify(
    user: FlagUser,
    traits: Record<string, unknown> = {},
  ): Promise<void> {
    this.entityId = user.id;
    this.entityAttributes = {
      email: user.email,
      name: user.name,
      ...traits,
    };

    // Notify listeners since identify can change every flag's evaluation.
    for (const cb of this.changeCallbacks) cb();

    return Promise.resolve();
  }

  variation<T = unknown>(
    flagName: string,
    { defaultValue }: VariationOptions<T> = {},
  ): T {
    if (!this.client) {
      return (this.localFlags[flagName] ?? defaultValue) as T;
    }

    try {
      const feature = this.client.getFeature(flagName);
      const value = feature.getCurrentValue(
        this.entityId,
        this.entityAttributes,
      );
      return (value ?? defaultValue) as T;
    } catch {
      // getFeature throws when the flag doesn't exist. Treat as missing
      // so the service records it as drift when running as a secondary.
      return (this.localFlags[flagName] ?? defaultValue) as T;
    }
  }

  onAnyChange(callback: ChangeCallback): Unsubscribe {
    this.changeCallbacks.add(callback);
    return () => {
      this.changeCallbacks.delete(callback);
    };
  }
}
