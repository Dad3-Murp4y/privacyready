import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import crypto from 'crypto';
import { prisma } from '../db.js';

const CLAIM_TOKEN_TTL_HOURS = 24;
const ANONYMOUS_SCAN_WINDOW_MS = 60_000;
const ANONYMOUS_SCAN_LIMIT = 3;
const anonymousScanAttempts = new Map<string, number[]>();

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

function publicWebsiteTarget(value: string): { target: string; hostname: string } {
  const target = value.trim();
  const candidate = target.includes('://') ? target : `https://${target}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('Enter a valid public HTTP or HTTPS website URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error('Enter a valid public HTTP or HTTPS website URL.');
  }
  return { target, hostname: parsed.hostname.toLowerCase() };
}

function isAnonymousScanRateLimited(sourceIp: string, hostname: string): boolean {
  const now = Date.now();
  const key = `${sourceIp}:${hostname}`;
  const recent = (anonymousScanAttempts.get(key) ?? []).filter((time) => now - time < ANONYMOUS_SCAN_WINDOW_MS);
  if (recent.length >= ANONYMOUS_SCAN_LIMIT) {
    anonymousScanAttempts.set(key, recent);
    return true;
  }
  recent.push(now);
  anonymousScanAttempts.set(key, recent);
  return false;
}

async function callScanner(endpoint: string, payload: object) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: SCANNER_HEADERS,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Scanner returned HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function redactFindings(findings: any) {
  if (!Array.isArray(findings)) return findings;
  return findings.map((f: any) => ({
    ...f,
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

  const PublicWebsiteScanSchema = {
    body: Type.Object({
      targetIdentifier: Type.String({ minLength: 1, maxLength: 512 }),
      scanType: Type.Literal('website')
    })
  };

  // Unauthenticated endpoint for landing page. Kept deliberately open (it's
  // the free-scan lead magnet), but rate-limited on top of the app-wide
  // limiter since it fans out to the scanner service and has no other
  // abuse protection.
  app.post('/api/public/scan', {
    schema: PublicWebsiteScanSchema,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    const { scanType } = request.body as any;
    let targetIdentifier: string;
    let hostname: string;
    try {
      ({ target: targetIdentifier, hostname } = publicWebsiteTarget((request.body as any).targetIdentifier));
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
    if (isAnonymousScanRateLimited(request.ip, hostname)) {
      return reply.code(429).send({ error: 'Too many scans for this website. Please try again shortly.' });
    }

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

    try {
      const result = await callScanner(scannerEndpoint(true), { customer_id: 'guest', url: targetIdentifier });

      const hasOnlyErrors = result.findings.length > 0 && result.findings.every((f: any) => ['scan_error', 'scan_blocked', 'scan_failed'].includes(f.finding_type));
      if (hasOnlyErrors) {
        throw new Error(result.findings[0].description);
      }

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
        id: updated.id,
        scanType: updated.scanType,
        targetIdentifier: updated.targetIdentifier,
        status: updated.status,
        score: updated.score,
        riskLevel: updated.riskLevel,
        findingsJson: redactFindings(updated.findingsJson),
        createdAt: updated.createdAt,
        completedAt: updated.completedAt,
        // The raw value is intentionally returned once for a possible
        // account-claim flow. Its stored hash and expiry never leave the API.
        claimToken: rawClaimToken
      };
    } catch (err: any) {
      await prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: 'FAILED',
          findingsJson: [{ description: 'Scan could not be completed.' }],
          completedAt: new Date()
        }
      });
      request.log.warn({ err }, 'Public website scan failed');
      return reply.code(400).send({ error: 'Scan could not be completed. Check that the target is a public website and try again.' });
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
    const { scanType } = request.body as any;
    const targetIdentifier = (request.body as any).targetIdentifier.trim();

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
      const result = await callScanner(scannerEndpoint(isWebsite), payload);

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
          findingsJson: [{ description: 'Scan could not be completed.' }],
          completedAt: new Date()
        }
      });
      request.log.warn({ err }, 'Authenticated scan failed');
      return reply.code(502).send({ ...failed, error: 'Scan could not be completed. Please try again.' });
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
