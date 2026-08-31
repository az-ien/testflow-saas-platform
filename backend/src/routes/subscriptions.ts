import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { authenticateJWT } from '../middleware/auth';
import { Subscription, PLAN_LIMITS, PlanId, BillingInterval, SubscriptionStatus } from '../models/Subscription';
import { User, SubscriptionTier } from '../models/User';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });

const STRIPE_PRICE_IDS: Record<string, string> = {
  starter_monthly:  process.env.STRIPE_PRICE_STARTER_MONTHLY || '',
  pro_monthly:      process.env.STRIPE_PRICE_PRO_MONTHLY || '',
  business_monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || '',
  starter_yearly:   process.env.STRIPE_PRICE_STARTER_YEARLY || '',
  pro_yearly:       process.env.STRIPE_PRICE_PRO_YEARLY || '',
  business_yearly:  process.env.STRIPE_PRICE_BUSINESS_YEARLY || '',
};

interface StripeSubscriptionMetadata {
  userId?: string;
  planId?: string;
  interval?: string;
}

const isPlanId = (planId: string | undefined): planId is PlanId =>
  Boolean(planId && Object.prototype.hasOwnProperty.call(PLAN_LIMITS, planId));

const normalizeBillingInterval = (interval: string | undefined): BillingInterval =>
  interval === 'yearly' ? 'yearly' : 'monthly';

const mapStripeStatus = (status: Stripe.Subscription.Status): SubscriptionStatus => {
  switch (status) {
    case 'active':
    case 'past_due':
    case 'trialing':
    case 'paused':
      return status;
    case 'canceled':
      return 'cancelled';
    default:
      return 'past_due';
  }
};

const toDate = (timestamp: number | null | undefined): Date | null =>
  typeof timestamp === 'number' ? new Date(timestamp * 1000) : null;

// GET /api/subscriptions/plans — Public pricing info
router.get('/plans', (_req, res) => {
  res.json({
    plans: [
      { id: 'free',     name: 'Free',     price: 0,   runs: 50,    parallel: 1  },
      { id: 'starter',  name: 'Starter',  price: 29,  runs: 500,   parallel: 2  },
      { id: 'pro',      name: 'Pro',      price: 99,  runs: 5000,  parallel: 5  },
      { id: 'business', name: 'Business', price: 299, runs: 25000, parallel: 20 },
    ],
  });
});

// GET /api/subscriptions/me
router.get('/me', authenticateJWT, async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({ where: { userId: req.user!.userId } });
    const user = await User.findByPk(req.user!.userId, { attributes: ['monthlyRunsUsed', 'monthlyRunsLimit'] });
    res.json({ subscription: sub, usage: user });
  } catch (err) { next(err); }
});

// POST /api/subscriptions/checkout — Create Stripe checkout session
router.post('/checkout', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId, interval = 'monthly' } = req.body;
    const priceKey = `${planId}_${interval}`;
    const priceId = STRIPE_PRICE_IDS[priceKey];
    if (!priceId) throw new AppError('Invalid plan or interval', 400);

    const user = await User.findByPk(req.user!.userId);
    if (!user) throw new AppError('User not found', 404);

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.fullName,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await user.update({ stripeCustomerId: customerId });
    }

    const metadata = { userId: user.id, planId, interval };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?upgrade=success`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata,
      subscription_data: { metadata },
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) { next(err); }
});

// POST /api/subscriptions/portal — Billing portal
router.post('/portal', authenticateJWT, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user!.userId);
    if (!user?.stripeCustomerId) throw new AppError('No billing account found', 400);

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/dashboard/settings`,
    });
    res.json({ portalUrl: session.url });
  } catch (err) { next(err); }
});

// POST /api/subscriptions/stripe-webhook — Stripe events
router.post('/stripe-webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;

  if (!webhookSecret) {
    logger.error('Stripe webhook secret is not configured');
    res.status(500).send('Webhook endpoint is not configured');
    return;
  }

  if (typeof sig !== 'string') {
    res.status(400).send('Stripe signature header is required');
    return;
  }

  if (!Buffer.isBuffer(req.body)) {
    logger.warn('Stripe webhook received a parsed body; raw body parser is required');
    res.status(400).send('Webhook payload must be sent as raw JSON');
    return;
  }

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown signature verification error';
    logger.warn(`Stripe webhook signature verification failed: ${message}`);
    res.status(400).send('Webhook signature verification failed');
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata as StripeSubscriptionMetadata | null;
        const userId = metadata?.userId;
        const planId = metadata?.planId;

        if (!userId || !isPlanId(planId)) {
          logger.warn(`Stripe checkout session ${session.id} is missing valid TestFlow metadata`);
          break;
        }

        const limits = PLAN_LIMITS[planId];
        const interval = normalizeBillingInterval(metadata?.interval);
        const stripeSubscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;

        await Subscription.update(
          {
            planId,
            status: 'active',
            billingInterval: interval,
            stripeSubscriptionId,
            stripePriceId: STRIPE_PRICE_IDS[`${planId}_${interval}`] || null,
            monthlyRunsLimit: limits.runs,
            parallelRunnersLimit: limits.parallel,
          },
          { where: { userId } }
        );
        await User.update({ subscriptionTier: planId as SubscriptionTier, monthlyRunsLimit: limits.runs }, { where: { id: userId } });
        logger.info(`Subscription upgraded to ${planId} for user ${userId}`);
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const metadata = sub.metadata as StripeSubscriptionMetadata;
        const userId = metadata?.userId;
        const planId = metadata?.planId;

        if (!userId || !isPlanId(planId)) {
          logger.warn(`Stripe subscription ${sub.id} is missing valid TestFlow metadata`);
          break;
        }

        const limits = PLAN_LIMITS[planId];
        await Subscription.update(
          {
            planId,
            status: mapStripeStatus(sub.status),
            stripeSubscriptionId: sub.id,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            currentPeriodStart: toDate(sub.current_period_start),
            currentPeriodEnd: toDate(sub.current_period_end),
            trialEnd: toDate(sub.trial_end),
            monthlyRunsLimit: limits.runs,
            parallelRunnersLimit: limits.parallel,
          },
          { where: { userId } }
        );
        await User.update({ subscriptionTier: planId as SubscriptionTier, monthlyRunsLimit: limits.runs }, { where: { id: userId } });
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const metadata = sub.metadata as StripeSubscriptionMetadata;
        let userId = metadata?.userId;

        if (!userId) {
          const stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
          const user = await User.findOne({ where: { stripeCustomerId }, attributes: ['id'] });
          userId = user?.id;
        }

        if (userId) {
          await Subscription.update({ planId: 'free', status: 'cancelled', monthlyRunsLimit: 50, parallelRunnersLimit: 1 }, { where: { userId } });
          await User.update({ subscriptionTier: 'free', monthlyRunsLimit: 50 }, { where: { id: userId } });
        } else {
          logger.warn(`Stripe subscription ${sub.id} deletion could not be mapped to a TestFlow user`);
        }
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('Stripe webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
