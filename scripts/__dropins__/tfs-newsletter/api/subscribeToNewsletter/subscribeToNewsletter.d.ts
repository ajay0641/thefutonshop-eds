/********************************************************************
 *  Copyright 2025 Adobe
 *  All Rights Reserved.
 *
 * NOTICE:  Adobe permits you to use, modify, and distribute this
 * file in accordance with the terms of the Adobe license agreement
 * accompanying it.
 *******************************************************************/
export type SubscriptionStatus = 'NOT_ACTIVE' | 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'UNCONFIRMED';
export interface SubscribeToNewsletterResult {
    status: SubscriptionStatus;
}
/**
 * Subscribe an email address to the Magento/Adobe Commerce newsletter.
 */
export declare const subscribeToNewsletter: (email: string) => Promise<SubscribeToNewsletterResult>;
//# sourceMappingURL=subscribeToNewsletter.d.ts.map