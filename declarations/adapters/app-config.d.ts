/**
 * Copyright IBM Corp. 2020, 2026
 */
import BaseFeatureFlagAdapter, { type FlagUser, type VariationOptions, type ChangeCallback, type Unsubscribe } from './base.ts';
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
    private client;
    private entityId;
    private entityAttributes;
    private localFlags;
    private changeCallbacks;
    init(config: AppConfigConfig): Promise<void>;
    identify(user: FlagUser, traits?: Record<string, unknown>): Promise<void>;
    variation<T = unknown>(flagName: string, { defaultValue }?: VariationOptions<T>): T;
    onAnyChange(callback: ChangeCallback): Unsubscribe;
}
//# sourceMappingURL=app-config.d.ts.map