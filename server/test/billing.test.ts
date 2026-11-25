import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { appleNotificationState, BillingNotConfiguredError, googleSubscriptionState, UnconfiguredVerifier } from '../src/economy/billing.ts';

describe('subscription state mapping', () => {
  it('maps App Store notifications, keeping access through grace and until expiry', () => {
    assert.equal(appleNotificationState('SUBSCRIBED', 'INITIAL_BUY'), 'active');
    assert.equal(appleNotificationState('DID_RENEW', null), 'active');
    assert.equal(appleNotificationState('DID_FAIL_TO_RENEW', 'GRACE_PERIOD'), 'grace');
    assert.equal(appleNotificationState('DID_FAIL_TO_RENEW', null), 'on_hold');
    assert.equal(appleNotificationState('GRACE_PERIOD_EXPIRED', null), 'on_hold');
    assert.equal(appleNotificationState('EXPIRED', 'VOLUNTARY'), 'expired');
    assert.equal(appleNotificationState('REFUND', null), 'refunded');
    assert.equal(appleNotificationState('REVOKE', null), 'revoked');
    assert.equal(appleNotificationState('DID_CHANGE_RENEWAL_STATUS', 'AUTO_RENEW_DISABLED'), null, 'turning off auto-renew keeps access');
  });

  it('maps Google Play subscription states', () => {
    assert.equal(googleSubscriptionState('SUBSCRIPTION_STATE_ACTIVE'), 'active');
    assert.equal(googleSubscriptionState('SUBSCRIPTION_STATE_CANCELED'), 'active', 'cancelled keeps access until expiry');
    assert.equal(googleSubscriptionState('SUBSCRIPTION_STATE_IN_GRACE_PERIOD'), 'grace');
    assert.equal(googleSubscriptionState('SUBSCRIPTION_STATE_ON_HOLD'), 'on_hold');
    assert.equal(googleSubscriptionState('SUBSCRIPTION_STATE_PAUSED'), 'on_hold');
    assert.equal(googleSubscriptionState('SUBSCRIPTION_STATE_EXPIRED'), 'expired');
    assert.equal(googleSubscriptionState('SUBSCRIPTION_STATE_PENDING'), null);
  });

  it('never simulates a successful purchase without credentials', async () => {
    const v = new UnconfiguredVerifier('apple');
    assert.equal(v.configured, false);
    await assert.rejects(() => v.verifyPurchase(), BillingNotConfiguredError);
    await assert.rejects(() => v.parseNotification(), BillingNotConfiguredError);
  });
});
