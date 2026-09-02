import Stripe from 'stripe';
import { logger } from '../config/logger';
import type { UsageDimension } from './UsageMeter';

const stripe = process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('xxxxx')
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

const meterFor: Record<UsageDimension, string | undefined> = {
  runs: process.env.STRIPE_METER_RUNS,
  planning: process.env.STRIPE_METER_PLANNING,
  healing: process.env.STRIPE_METER_HEALING,
  exploration: process.env.STRIPE_METER_EXPLORATION,
};

export const recordStripeMeter = async (
  customerId: string | null | undefined,
  dimension: UsageDimension
): Promise<void> => {
  const eventName = meterFor[dimension];
  if (!stripe || !customerId || !eventName) return;
  try {
    await (stripe as any).request({
      method: 'POST',
      path: '/v1/billing/meter_events',
      body: { event_name: eventName, payload: { stripe_customer_id: customerId, value: '1' } },
    });
  } catch (err: any) {
    logger.warn('Stripe meter event failed', { dimension, error: err.message });
  }
};
