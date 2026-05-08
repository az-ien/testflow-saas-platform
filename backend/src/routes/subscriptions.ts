import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { authenticateJWT } from '../middleware/auth';
import { Subscription, PLAN_LIMITS, PlanId } from '../models/Subscription';
import { User } from '../models/User';
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

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?upgrade=success`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: { userId: user.id, planId },
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
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch {
    res.status(400).send('Webhook signature verification failed');
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userId, planId } = session.metadata!;
        const limits = PLAN_LIMITS[planId as PlanId];
        await Subscription.update(
          { planId: planId as PlanId, status: 'active', stripeSubscriptionId: session.subscription as string, monthlyRunsLimit: limits.runs, parallelRunnersLimit: limits.parallel },
          { where: { userId } }
        );
        await User.update({ subscriptionTier: planId as any, monthlyRunsLimit: limits.runs }, { where: { id: userId } });
        logger.info(`Subscription upgraded to ${planId} for user ${userId}`);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) {
          await Subscription.update({ planId: 'free', status: 'cancelled', monthlyRunsLimit: 50, parallelRunnersLimit: 1 }, { where: { userId } });
          await User.update({ subscriptionTier: 'free', monthlyRunsLimit: 50 }, { where: { id: userId } });
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
