import { FastifyInstance } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import { prisma } from '../db.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

function requireStripeConfiguration() {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe billing is not configured');
  }
}

function isAllowedReturnUrl(value: string) {
  try {
    const returnUrl = new URL(value);
    const portalUrl = new URL(process.env.PORTAL_URL || 'https://portal.privacyready.co.uk');
    return returnUrl.origin === portalUrl.origin;
  } catch {
    return false;
  }
}

export function verifyStripeWebhookSignature(
  rawPayload: Buffer,
  signatureHeader: string,
  webhookSecret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const fields = signatureHeader.split(',').map((field) => field.trim());
  const timestampField = fields.find((field) => field.startsWith('t='));
  const signatureFields = fields
    .filter((field) => field.startsWith('v1='))
    .map((field) => field.slice(3));

  if (!timestampField || signatureFields.length === 0) return false;

  const timestamp = Number(timestampField.slice(2));
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300) return false;

  const expected = createHmac('sha256', webhookSecret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), rawPayload]))
    .digest();

  return signatureFields.some((signature) => {
    if (!/^[a-fA-F0-9]{64}$/.test(signature)) return false;

    const candidate = Buffer.from(signature, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}

export async function registerBillingRoutes(app: FastifyInstance) {
  // Authentication hook for protected billing routes
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.includes('/webhook')) {
      return;
    }

    try {
      await request.jwtVerify();
      const tokenUser = request.user as any;
      const realUser = await prisma.user.findUnique({ where: { id: tokenUser.sub } });
      if (!realUser) return reply.code(401).send({ error: 'Unauthorized' });
      request.user = { ...tokenUser, role: realUser.role, org: realUser.organizationId, email: realUser.email };
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Get current subscription status
  app.get('/subscription-status', async (request, reply) => {
    const user = request.user as any;
    if (!user || !user.org) {
      return { subscriptionStatus: 'free', stripeCustomerId: null, isPremium: false };
    }

    const org = await prisma.organization.findUnique({
      where: { id: user.org }
    });

    if (!org) {
      return { subscriptionStatus: 'free', stripeCustomerId: null, isPremium: false };
    }

    return {
      subscriptionStatus: org.subscriptionStatus || 'free',
      stripeCustomerId: org.stripeCustomerId || null,
      isPremium: org.subscriptionStatus === 'active',
      orgName: org.name
    };
  });

  // Create a Stripe Checkout session
  app.post('/create-checkout-session', async (request, reply) => {
    const user = request.user as any;
    const { returnUrl, plan = 'starter' } = (request.body || {}) as { returnUrl?: string; plan?: 'starter' | 'growth' };
    
    if (!returnUrl || !isAllowedReturnUrl(returnUrl)) {
      return reply.code(400).send({ error: 'Invalid returnUrl' });
    }

    let orgId = user?.org || user?.organizationId;
    let org = orgId ? await prisma.organization.findUnique({ where: { id: orgId } }) : null;

    if (!org) {
      const userRecord = await prisma.user.findUnique({ where: { id: user.id } });
      org = await prisma.organization.create({
        data: {
          name: `${userRecord?.email || 'User'}'s Organization`,
          subscriptionStatus: 'free'
        }
      });
      if (userRecord) {
        await prisma.user.update({
          where: { id: user.id },
          data: { organizationId: org.id }
        });
      }
      orgId = org.id;
    }

    requireStripeConfiguration();
    const stripeKey = STRIPE_SECRET_KEY;

    const isGrowth = plan === 'growth';
    const planName = isGrowth ? 'Growth' : 'Founder';
    const planDesc = isGrowth 
      ? 'Full UK GDPR compliance suite, Consent Manager, Vendor ROPA, Staff Training & Priority Support'
      : 'Founder subscription, Policy Generators, DSR Tracker & Article 33 Breach Register';
    const unitAmount = isGrowth ? 3900 : 1500; // £39.00 or £15.00

    const priceId = isGrowth 
      ? (process.env.STRIPE_GROWTH_PRICE_ID || process.env.STRIPE_PRICE_ID)
      : (process.env.STRIPE_STARTER_PRICE_ID || process.env.STRIPE_FOUNDER_PRICE_ID || process.env.STRIPE_PRICE_ID);

    // Dynamic inline product if IDs are missing

    // Build form-urlencoded payload for Stripe REST API
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('payment_method_types[0]', 'card');
    params.append('customer_email', user.email);
    params.append('client_reference_id', user.org);
    params.append('success_url', `${returnUrl}?session_id={CHECKOUT_SESSION_ID}&payment=success`);
    params.append('cancel_url', `${returnUrl}?payment=cancelled`);

    if (priceId) {
      params.append('line_items[0][price]', priceId);
      params.append('line_items[0][quantity]', '1');
    } else {
      params.append('line_items[0][price_data][currency]', 'gbp');
      params.append('line_items[0][price_data][product_data][name]', `PrivacyReady ${planName} Plan`);
      params.append('line_items[0][price_data][product_data][description]', planDesc);
      params.append('line_items[0][price_data][unit_amount]', String(unitAmount));
      params.append('line_items[0][price_data][recurring][interval]', 'month');
      params.append('line_items[0][quantity]', '1');
    }

    try {
      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const session = await response.json();

      if (!response.ok) {
        app.log.error({ session }, 'Stripe API error');
        return reply.code(400).send({ error: session.error?.message || 'Failed to create Stripe session' });
      }

      return {
        url: session.url,
        sessionId: session.id
      };
    } catch (err) {
      app.log.error({ err }, 'Stripe checkout error');
      return reply.code(500).send({ error: 'Internal server error creating checkout session' });
    }
  });

  // Verify Checkout Session completion
  app.post('/verify-session', async (request, reply) => {
    const user = request.user as any;
    const { sessionId } = (request.body as any) || {};

    if (!sessionId) {
      return reply.code(400).send({ error: 'Missing sessionId' });
    }

    requireStripeConfiguration();
    const stripeKey = STRIPE_SECRET_KEY;

    try {
      const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${stripeKey}` }
      });

      const session = await response.json();

      if (response.ok && (session.payment_status === 'paid' || session.status === 'complete') && session.client_reference_id === user.org) {
        await prisma.organization.update({
          where: { id: user.org },
          data: {
            subscriptionStatus: 'active',
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : null
          }
        });
        return { success: true, subscriptionStatus: 'active' };
      }

      return reply.code(400).send({ error: 'Payment not completed or session invalid' });
    } catch (err) {
      return reply.code(500).send({ error: 'Failed to verify session with Stripe' });
    }
  });

  // Create Stripe Customer Portal session
  app.post('/create-portal-session', async (request, reply) => {
    const user = request.user as any;
    const { returnUrl } = (request.body as any) || {};

    if (!returnUrl || !isAllowedReturnUrl(returnUrl)) {
      return reply.code(400).send({ error: 'Invalid returnUrl' });
    }

    const org = await prisma.organization.findUnique({ where: { id: user.org } });
    if (!org || !org.stripeCustomerId) {
      return reply.code(400).send({ error: 'No active subscription or customer ID found' });
    }

    requireStripeConfiguration();
    const stripeKey = STRIPE_SECRET_KEY;

    const params = new URLSearchParams();
    params.append('customer', org.stripeCustomerId);
    params.append('return_url', returnUrl);

    try {
      const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const session = await response.json();

      if (!response.ok) {
        app.log.error({ session }, 'Stripe Portal API error');
        return reply.code(400).send({ error: session.error?.message || 'Failed to create portal session' });
      }

      return { url: session.url };
    } catch (err) {
      app.log.error({ err }, 'Stripe portal error');
      return reply.code(500).send({ error: 'Internal server error creating portal session' });
    }
  });

  app.post('/webhook', {
    preParsing: async (request, _reply, payload) => {
      const chunks: Buffer[] = [];
      for await (const chunk of payload) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const rawBody = Buffer.concat(chunks);
      (request as typeof request & { rawBody?: Buffer }).rawBody = rawBody;

      const replacementPayload = Readable.from(rawBody);
      (replacementPayload as typeof replacementPayload & { receivedEncodedLength?: number }).receivedEncodedLength = rawBody.length;
      return replacementPayload;
    },
  }, async (request, reply) => {
    const event = request.body as any;
    const rawBody = (request as typeof request & { rawBody?: Buffer }).rawBody;
    const signature = request.headers['stripe-signature'];

    if (
      !STRIPE_WEBHOOK_SECRET
      || !rawBody
      || typeof signature !== 'string'
      || !verifyStripeWebhookSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET)
    ) {
      return reply.code(400).send({ error: 'Invalid Stripe signature' });
    }

    if (!event || !event.type) {
      return reply.code(400).send({ error: 'Invalid webhook payload' });
    }

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const orgId = session.client_reference_id;
        const customerId = session.customer;

        if (orgId) {
          await prisma.organization.update({
            where: { id: orgId },
            data: {
              subscriptionStatus: 'active',
              stripeCustomerId: typeof customerId === 'string' ? customerId : null
            }
          });
        }
      } else if (event.type === 'customer.subscription.updated') {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status; // active, past_due, canceled, unpaid

        if (customerId) {
          await prisma.organization.updateMany({
            where: { stripeCustomerId: customerId },
            data: { subscriptionStatus: status === 'active' ? 'active' : (status === 'canceled' ? 'canceled' : 'past_due') }
          });
        }
      } else if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        if (customerId) {
          await prisma.organization.updateMany({
            where: { stripeCustomerId: customerId },
            data: { subscriptionStatus: 'canceled' }
          });
        }
      } else if (event.type === 'invoice.payment_failed') {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        if (customerId) {
          await prisma.organization.updateMany({
            where: { stripeCustomerId: customerId },
            data: { subscriptionStatus: 'past_due' }
          });
        }
      }

      return { received: true };
    } catch (err) {
      app.log.error({ err }, 'Webhook processing failed');
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });
}
