import { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { prisma } from '../db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'dummy_key', {
  apiVersion: '2024-04-10' as any,
});

export async function registerBillingRoutes(app: FastifyInstance) {
  // Checkout Session
  app.post('/api/billing/checkout', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const user = request.user as any;
    const org = await prisma.organization.findUnique({ where: { id: user.org } });

    if (!org) {
      return reply.status(404).send({ error: 'Organization not found' });
    }

    if (org.subscriptionStatus === 'active') {
      return reply.status(400).send({ error: 'Already subscribed' });
    }

    if (!process.env.STRIPE_PRICE_ID) {
      return reply.status(500).send({ error: 'Stripe configuration missing' });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: process.env.STRIPE_PRICE_ID,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.FRONTEND_URL || 'https://portal.privacyready.co.uk'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'https://portal.privacyready.co.uk'}/dashboard`,
        client_reference_id: org.id,
      });

      return reply.send({ url: session.url });
    } catch (err) {
      console.error('Stripe error:', err);
      return reply.status(500).send({ error: 'Failed to create checkout session' });
    }
  });

  // Webhook
  app.post('/api/billing/webhook', { config: { rawBody: true } }, async (request, reply) => {
    const sig = request.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return reply.status(400).send({ error: 'Webhook Secret missing' });
    }

    let event: Stripe.Event;

    try {
      // Note: Fastify requires the raw body buffer for Stripe webhooks.
      // This assumes you have a raw body parser plugin enabled or send the stringified body.
      const payload = (request as any).rawBody || JSON.stringify(request.body);
      event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
    } catch (err: any) {
      return reply.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.client_reference_id;
        if (orgId) {
          await prisma.organization.update({
            where: { id: orgId },
            data: { 
              stripeCustomerId: session.customer as string,
              subscriptionStatus: 'active'
            }
          });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await prisma.organization.updateMany({
          where: { stripeCustomerId: subscription.customer as string },
          data: { subscriptionStatus: 'canceled' }
        });
        break;
      }
    }

    return reply.send({ received: true });
  });
}
