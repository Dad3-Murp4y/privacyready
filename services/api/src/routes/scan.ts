import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import crypto from 'crypto';
import { prisma } from '../db.js';

const CLAIM_TOKEN_TTL_HOURS = 24;

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Shared secret with the scanner service -- see main.py's require_api_key.
// Same "fail loudly at startup rather than silently run insecurely"
// pattern as JWT_SECRET in main.ts.
if (!process.env.SCANNER_API_KEY) {
  throw new Error(
    'SCANNER_API_KEY environment variable is required and must not be empty.'
  );
}
const SCANNER_API_KEY = process.env.SCANNER_API_KEY;
const SCANNER_HEADERS = {
  'Content-Type': 'application/json',
  'X-Scanner-Api-Key': SCANNER_API_KEY
};

function scannerEndpoint(isWebsite: boolean): string {
  const baseUrl = process.env.SCANNER_URL || 'http://scanner.privacyready.local:8080';
  return isWebsite ? `${baseUrl}/v1/scan/website` : `${baseUrl}/v1/scan/social`;
}

function redactFindings(findings: any) {
  if (!Array.isArray(findings)) return findings;
  return findings.map((f: any) => ({
    ...f,
    finding_type: 'REDACTED',
    severity: 'REDACTED',
    description: 'Premium detailed finding description is hidden. Upgrade to view full remediation steps.',
    evidence: 'Redacted (Premium only)',
    gdpr_article: 'REDACTED',
    remediation: 'Redacted (Premium only)'
  }));
}

export async function registerScanRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    // Only protect /api/scan (but not /api/public)
    if (!request.url.startsWith('/api/scan') || request.url.startsWith('/api/public')) {
      return;
    }

    try {
      await request.jwtVerify();
      const tokenUser = request.user as any;
      const realUser = await prisma.user.findUnique({ where: { id: tokenUser.sub } });
      if (!realUser) return reply.code(401).send({ error: 'Unauthorized' });
      request.user = { ...tokenUser, role: realUser.role, org: realUser.organizationId };
    } catch (err) {
      return reply.send(err);
    }
  });

  const CreateScanSchema = {
    body: Type.Object({
      targetIdentifier: Type.String({ minLength: 1, maxLength: 512 }),
      scanType: Type.Union([
        Type.Literal('website'),
        Type.Literal('facebook'),
        Type.Literal('instagram'),
        Type.Literal('linkedin'),
        Type.Literal('mailchimp'),
        Type.Literal('twitter'),
        Type.Literal('google_analytics'),
        Type.Literal('whatsapp'),
        Type.Literal('tiktok')
      ])
    })
  };

  // Unauthenticated endpoint for landing page. Kept deliberately open (it's
  // the free-scan lead magnet), but rate-limited on top of the app-wide
  // limiter since it fans out to the scanner service and has no other
  // abuse protection.
  app.post('/api/public/scan', {
    schema: CreateScanSchema,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    const { targetIdentifier, scanType } = request.body as any;

    // A raw, single-use claim token is generated alongside the scan and
    // only its hash is stored -- the same pattern used for email
    // verification. Registering with the *scan id* alone used to be
    // enough to claim someone else's free-scan report (IDOR); now the
    // claim requires possession of this token, which is only ever
    // returned once, in this response, to whoever ran the scan.
    const rawClaimToken = crypto.randomBytes(32).toString('hex');
    const claimTokenExpires = new Date(Date.now() + CLAIM_TOKEN_TTL_HOURS * 60 * 60 * 1000);

    const scan = await prisma.scan.create({
      data: {
        scanType,
        targetIdentifier,
        status: 'PENDING',
        claimTokenHash: hashToken(rawClaimToken),
        claimTokenExpires
        // organizationId is left null until claimed at registration
      }
    });

    const isWebsite = scanType === 'website';
    let payload: any = { customer_id: 'guest' };
    if (isWebsite) {
      payload.url = targetIdentifier;
    } else {
      const typeMap: Record<string, string> = {
        'tiktok': 'tiktok_username',
        'facebook': 'facebook_page_id',
        'instagram': 'ig_account_id',
        'twitter': 'twitter_username',
        'google_analytics': 'ga_property_id',
        'whatsapp': 'whatsapp_phone',
        'linkedin': 'linkedin_company_id',
        'mailchimp': 'mailchimp_api_key'
      };
      payload[typeMap[scanType] || 'tiktok_username'] = targetIdentifier;
    }

    try {
      const response = await fetch(scannerEndpoint(isWebsite), {
        method: 'POST',
        headers: SCANNER_HEADERS,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Scanner returned HTTP ${response.status}`);
      }

      const result = await response.json();

      const updated = await prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: 'COMPLETED',
          score: result.gdpr_compliance_percentage,
          riskLevel: result.risk_level,
          findingsJson: result.findings,
          completedAt: new Date()
        }
      });
      return { 
        ...updated, 
        findingsJson: redactFindings(updated.findingsJson),
        claimToken: rawClaimToken 
      };
    } catch (err) {
      const failed = await prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: 'FAILED',
          findingsJson: [{ description: `Scanner failed: ${String(err)}` }],
          completedAt: new Date()
        }
      });
      return { ...failed, claimToken: rawClaimToken };
    }
  });


  app.get('/api/scan', async (request, reply) => {
    const user = request.user as any;
    const scans = await prisma.scan.findMany({
      where: { organizationId: user.org },
      orderBy: { createdAt: 'desc' }
    });

    const org = await prisma.organization.findUnique({ where: { id: user.org } });
    const isPremium = org?.subscriptionStatus === 'active';

    if (!isPremium) {
      scans.forEach(scan => {
        scan.findingsJson = redactFindings(scan.findingsJson);
      });
    }

    return scans;
  });

  app.post('/api/scan', { schema: CreateScanSchema }, async (request, reply) => {
    const user = request.user as any;
    const { targetIdentifier, scanType } = request.body as any;

    const scan = await prisma.scan.create({
      data: {
        scanType,
        targetIdentifier,
        status: 'PENDING',
        organizationId: user.org
      }
    });

    const isWebsite = scanType === 'website';
    let payload: any = { customer_id: user.org };
    if (isWebsite) {
      payload.url = targetIdentifier;
    } else {
      const typeMap: Record<string, string> = {
        'tiktok': 'tiktok_username',
        'facebook': 'facebook_page_id',
        'instagram': 'ig_account_id',
        'twitter': 'twitter_username',
        'google_analytics': 'ga_property_id',
        'whatsapp': 'whatsapp_phone',
        'linkedin': 'linkedin_company_id',
        'mailchimp': 'mailchimp_api_key'
      };
      payload[typeMap[scanType] || 'tiktok_username'] = targetIdentifier;
    }

    try {
      const response = await fetch(scannerEndpoint(isWebsite), {
        method: 'POST',
        headers: SCANNER_HEADERS,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Scanner returned HTTP ${response.status}`);
      }

      const result = await response.json();

      const updated = await prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: 'COMPLETED',
          score: result.gdpr_compliance_percentage,
          riskLevel: result.risk_level,
          findingsJson: result.findings, // Store the real findings securely in DB
          completedAt: new Date()
        }
      });
      
      // Redact for response if not premium
      let responseFindings = result.findings;
      const org = await prisma.organization.findUnique({ where: { id: user.org } });
      if (org?.subscriptionStatus !== 'active') {
        responseFindings = redactFindings(responseFindings);
      }

      return {
        ...updated,
        findingsJson: responseFindings
      };
    } catch (err) {
      const failed = await prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: 'FAILED',
          findingsJson: [{ description: `Scanner failed: ${String(err)}` }],
          completedAt: new Date()
        }
      });
      return failed;
    }
  });

  // Delete a scan from the caller's own org. Previously the dashboard's
  // delete button only filtered client-side React state -- the row came
  // back on reload because nothing was ever deleted server-side.
  app.delete('/api/scan/:id', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    const existing = await prisma.scan.findFirst({
      where: { id, organizationId: user.org }
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Scan not found in your organization' });
    }

    await prisma.scan.delete({ where: { id } });
    return reply.status(204).send();
  });
}
