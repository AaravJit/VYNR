/**
 * VYNR Black subscription entitlements.
 *
 * The server is the only source of truth: the app never says "I am
 * subscribed". It sends the store's signed transaction (Apple) or purchase
 * token (Google); a platform verifier checks it with Apple or Google and
 * returns the verified state, which is stored and kept current by
 * server-to-server notifications (App Store Server Notifications V2, Google
 * Play RTDN). See docs/SUBSCRIPTIONS.md and docs/SOURCE_REGISTER.md.
 *
 * No verifier with real credentials exists yet. Until the owner provides
 * them, both platforms use `UnconfiguredVerifier`, which refuses every request:
 * a purchase is never simulated as successful.
 */
export type EntitlementState = 'active' | 'grace' | 'on_hold' | 'expired' | 'revoked' | 'refunded';
export type Platform = 'apple' | 'google';

export interface VerifiedSubscription {
  platform: Platform;
  environment: 'sandbox' | 'production';
  productId: string;
  originalTransactionId: string;
  state: EntitlementState;
  expiresAt: number | null;
}

export interface BillingVerifier {
  readonly platform: Platform;
  readonly configured: boolean;
  /** Verifies a client-supplied proof of purchase with the store. */
  verifyPurchase(proof: string, productId: string): Promise<VerifiedSubscription>;
  /** Verifies and decodes a server-to-server notification. Returns null for notifications that do not change access. */
  parseNotification(body: unknown): Promise<{ originalTransactionId: string; state: EntitlementState; expiresAt: number | null } | null>;
}

export class BillingNotConfiguredError extends Error {
  constructor(platform: Platform) {
    super(`${platform} billing is not configured on this server`);
    this.name = 'BillingNotConfiguredError';
  }
}

export class BillingRejectedError extends Error {
  constructor(message = 'The store did not confirm this purchase') {
    super(message);
    this.name = 'BillingRejectedError';
  }
}

/** Refuses everything. Used until store credentials and approval exist. */
export class UnconfiguredVerifier implements BillingVerifier {
  readonly configured = false;
  readonly platform: Platform;
  constructor(platform: Platform) {
    this.platform = platform;
  }
  async verifyPurchase(): Promise<VerifiedSubscription> {
    throw new BillingNotConfiguredError(this.platform);
  }
  async parseNotification(): Promise<null> {
    throw new BillingNotConfiguredError(this.platform);
  }
}

/**
 * Maps an App Store Server Notification V2 (notificationType, subtype) to an
 * entitlement state, or null when access does not change (for example the
 * player turning off auto-renew keeps access until the period ends).
 */
export function appleNotificationState(type: string, subtype: string | null): EntitlementState | null {
  switch (type) {
    case 'SUBSCRIBED':
    case 'DID_RENEW':
    case 'OFFER_REDEEMED':
    case 'REFUND_REVERSED':
      return 'active';
    case 'DID_FAIL_TO_RENEW':
      return subtype === 'GRACE_PERIOD' ? 'grace' : 'on_hold';
    case 'GRACE_PERIOD_EXPIRED':
      return 'on_hold';
    case 'EXPIRED':
      return 'expired';
    case 'REFUND':
      return 'refunded';
    case 'REVOKE':
      return 'revoked';
    default:
      return null;
  }
}

/**
 * Maps a Google Play `purchases.subscriptionsv2` subscriptionState to an
 * entitlement state. A cancelled subscription keeps access until it expires;
 * account hold and pause remove access; grace period keeps it.
 */
export function googleSubscriptionState(state: string): EntitlementState | null {
  switch (state) {
    case 'SUBSCRIPTION_STATE_ACTIVE':
    case 'SUBSCRIPTION_STATE_CANCELED':
      return 'active';
    case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD':
      return 'grace';
    case 'SUBSCRIPTION_STATE_ON_HOLD':
    case 'SUBSCRIPTION_STATE_PAUSED':
      return 'on_hold';
    case 'SUBSCRIPTION_STATE_EXPIRED':
      return 'expired';
    case 'SUBSCRIPTION_STATE_PENDING':
    case 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED':
      return null;
    default:
      return null;
  }
}

/** What VYNR Black adds. Shown on the paywall from this one list; nothing here touches odds, VC or the market. */
export const BLACK_BENEFITS = [
  'Higher daily automatic identification allowance',
  'Advanced vehicle intel where licensed data exists',
  'Generation comparisons',
  'Advanced collection statistics',
  'Premium garage environments and scanner skins',
  'Exclusive profile frames and titles',
  'Premium season track (cosmetic rewards only)',
  'Larger public showcase',
] as const;

export const BLACK_PRODUCTS = {
  monthly: { id: 'vynr.black.monthly', provisionalPriceUsd: 5.99, period: 'P1M' },
  annual: { id: 'vynr.black.annual', provisionalPriceUsd: 49.99, period: 'P1Y' },
} as const;
