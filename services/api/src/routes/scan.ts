import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { safeErrorMetadata } from '../safe-logging.js';

type ScanPrisma = Pick<typeof prisma, 'scan' | 'user' | 'organization'>;

interface ScanRouteDependencies {
  prismaClient?: ScanPrisma;
}

const CLAIM_TOKEN_TTL_HOURS = 24;
const ANONYMOUS_SCAN_WINDOW_MS = 60_000;
const ANONYMOUS_SCAN_LIMIT = 3;
const anonymousScanAttempts = new Map<string, number[]>();

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function claimAnonymousScan(
  prismaClient: ScanPrisma,
  organizationId: string,
  claimToken: string,
  now = new Date(),
) {
  const claimTokenHash = hashToken(claimToken);
  const candidate = await prismaClient.scan.findFirst({
    where: {
      organizationId: null,
      claimTokenHash,
      claimTokenExpires: { gt: now },
    },
    select: { id: true, status: true },
  });
  if (!candidate) return null;

  // Keep the ownership, token and expiry predicates in the write itself. If
  // two requests race, only one can clear the hash and attach the scan.
  const claimed = await prismaClient.scan.updateMany({
    where: {
      id: candidate.id,
      organizationId: null,
      claimTokenHash,
      claimTokenExpires: { gt: now },
    },
    data: {
      organizationId,
      claimTokenHash: null,
      claimTokenExpires: null,
    },
  });
  return claimed.count === 1 ? candidate : null;
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
  const supplied = value.trim();
  const candidate = supplied.includes('://') ? supplied : `https://${supplied}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('Enter a valid public HTTP or HTTPS website URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error('Enter a valid public HTTP or HTTPS website URL.');
  }
  parsed.username = '';
  parsed.password = '';
  parsed.search = '';
  parsed.hash = '';
  const target = supplied.includes('://') ? parsed.toString() : parsed.toString().replace(/^https:\/\//, '').replace(/\/$/, '');
  return { target, hostname: parsed.hostname.toLowerCase() };
}

function resemblesCredential(value: string): boolean {
  const candidate = value.trim();
  const knownCredentialPrefix = /^(?:gh[pousr]_|github_pat_|xox[baprs]-|AKIA|ASIA|AIza|ya29\.)/;
  const [hexValue, regionalSuffix, ...extraParts] = candidate.toLowerCase().split('-');
  const resemblesHexKey = hexValue.length >= 32
    && hexValue.length <= 512
    && [...hexValue].every((character) => '0123456789abcdef'.includes(character))
    && extraParts.length === 0
    && (regionalSuffix === undefined || /^[a-z]{2}\d{1,6}$/.test(regionalSuffix));
  return /^(?:bearer\s+|(?:api[_ -]?key|access[_ -]?token|password|secret)\s*[:=])/i.test(candidate)
    || knownCredentialPrefix.test(candidate)
    || /^(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]+$/.test(candidate)
    || /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(candidate)
    || resemblesHexKey;
}

function minimiseWebsiteEvidence(value: string): string {
  return value
    .replace(/https?:\/\/[^/\s@]+@/gi, 'https://[credentials removed]@')
    .replace(/([?&][^\s]*)/g, '[query removed]');
}

const FINDING_STRING_FIELDS = ['platform', 'finding_type', 'severity', 'description', 'gdpr_article', 'remediation', 'status', 'checkName', 'title', 'detail'] as const;

function boundedText(value: unknown, maxLength = 2000): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, maxLength) : undefined;
}

export function sanitizeScannerFindings(findings: unknown, scanType: string): Array<Record<string, string | boolean>> {
  if (!Array.isArray(findings)) return [];
  return findings.slice(0, 500).map((finding: unknown) => {
    if (!finding || typeof finding !== 'object') return { finding_type: 'unknown', severity: 'unknown' };
    const source = finding as Record<string, unknown>;
    const result: Record<string, string | boolean> = {};
    for (const field of FINDING_STRING_FIELDS) {
      const value = boundedText(source[field]);
      if (value) result[field] = value;
    }
    if (typeof source.passed === 'boolean') result.passed = source.passed;
    const findingType = String(source.finding_type ?? '');
    if (findingType.includes('error') || findingType.includes('failed') || findingType.includes('blocked')) {
      result.description = 'This check could not be completed.';
      delete result.detail;
    } else if (scanType === 'website') {
      const evidence = boundedText(source.evidence, 1000);
      if (evidence) result.evidence = minimiseWebsiteEvidence(evidence);
    }
    return result;
  });
}

function scannerRequestFor(scanType: string, targetIdentifier: string, organizationId: string): Record<string, string> {
  switch (scanType) {
    case 'website': return { customer_id: organizationId, url: targetIdentifier };
    case 'tiktok': return { customer_id: organizationId, tiktok_username: targetIdentifier };
    case 'facebook': return { customer_id: organizationId, facebook_page_id: targetIdentifier };
    case 'instagram': return { customer_id: organizationId, ig_account_id: targetIdentifier };
    case 'twitter': return { customer_id: organizationId, twitter_username: targetIdentifier };
    case 'google_analytics': return { customer_id: organizationId, ga_property_id: targetIdentifier };
    case 'whatsapp': return { customer_id: organizationId, whatsapp_phone: targetIdentifier };
    case 'linkedin': return { customer_id: organizationId, linkedin_company_id: targetIdentifier };
    default: throw new Error('Unsupported scan type');
  }
}

function scanResponse(scan: any, findingsJson = scan.findingsJson) {
  return {
    id: scan.id,
    scanType: scan.scanType,
    targetIdentifier: scan.targetIdentifier,
    status: scan.status,
    score: scan.score,
    riskLevel: scan.riskLevel,
    findingsJson,
    organizationId: scan.organizationId,
    createdAt: scan.createdAt,
    completedAt: scan.completedAt,
  };
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

const FREE_FINDING_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);

/**
 * The complete free finding contract. Keep this allowlist deliberately small:
 * free users may see issue counts and risk distribution, but no diagnostic
 * fields that explain what was found or how to remediate it.
 */
function freeFindingSummaries(findings: unknown) {
  if (!Array.isArray(findings)) return [];
  return findings.filter((finding: unknown) => {
    if (!finding || typeof finding !== 'object') return true;
    const candidate = finding as { passed?: unknown; status?: unknown };
    return candidate.passed !== true && String(candidate.status ?? '').toUpperCase() !== 'PASS';
  }).map((finding: unknown) => {
    const rawSeverity = finding && typeof finding === 'object' && 'severity' in finding
      ? String((finding as { severity?: unknown }).severity).toLowerCase()
      : '';
    return { severity: FREE_FINDING_SEVERITIES.has(rawSeverity) ? rawSeverity : 'unknown' };
  });
}

export async function registerScanRoutes(app: FastifyInstance, dependencies: ScanRouteDependencies = {}) {
  const prismaClient = dependencies.prismaClient ?? prisma;
  app.addHook('onRequest', async (request, reply) => {
    // Only protect /api/scan (but not /api/public)
    if (!request.url.startsWith('/api/scan') || request.url.startsWith('/api/public')) {
      return;
    }

    try {
      await request.jwtVerify();
      const tokenUser = request.user as any;
      const realUser = await prismaClient.user.findUnique({ where: { id: tokenUser.sub } });
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

    const scan = await prismaClient.scan.create({
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
      const safeFindings = sanitizeScannerFindings(result.findings, scanType);

      const hasOnlyErrors = safeFindings.length > 0 && safeFindings.every((f: any) => ['scan_error', 'scan_blocked', 'scan_failed'].includes(f.finding_type));
      if (hasOnlyErrors) {
        throw new Error(result.findings[0].description);
      }

      const updated = await prismaClient.scan.update({
        where: { id: scan.id },
        data: {
          status: 'COMPLETED',
          score: result.gdpr_compliance_percentage,
          riskLevel: result.risk_level,
          findingsJson: safeFindings,
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
        findingsJson: freeFindingSummaries(updated.findingsJson),
        createdAt: updated.createdAt,
        completedAt: updated.completedAt,
        // The raw value is intentionally returned once for a possible
        // account-claim flow. Its stored hash and expiry never leave the API.
        claimToken: rawClaimToken
      };
    } catch (err: any) {
      await prismaClient.scan.update({
        where: { id: scan.id },
        data: {
          status: 'FAILED',
          findingsJson: [{ description: 'Scan could not be completed.' }],
          completedAt: new Date()
        }
      });
      request.log.warn(safeErrorMetadata(err), 'Public website scan failed');
      return reply.code(400).send({ error: 'Scan could not be completed. Check that the target is a public website and try again.' });
    }
  });


  app.get('/api/scan', async (request, reply) => {
    const user = request.user as any;
    const scans = await prismaClient.scan.findMany({
      where: { organizationId: user.org },
      orderBy: { createdAt: 'desc' }
    });

    const org = await prismaClient.organization.findUnique({ where: { id: user.org } });
    const isPremium = org?.subscriptionStatus === 'active';

    if (!isPremium) {
      scans.forEach(scan => {
        scan.findingsJson = freeFindingSummaries(scan.findingsJson);
      });
    }

    return scans;
  });

  app.post('/api/scan', { schema: CreateScanSchema }, async (request, reply) => {
    const user = request.user as any;
    const { scanType } = request.body as { scanType: string };
    let targetIdentifier = (request.body as { targetIdentifier: string }).targetIdentifier.trim();
    if (scanType === 'website') {
      try {
        targetIdentifier = publicWebsiteTarget(targetIdentifier).target;
      } catch (err: any) {
        return reply.code(400).send({ error: err.message });
      }
    } else if (resemblesCredential(targetIdentifier)) {
      return reply.code(400).send({ error: 'Credentials and secrets cannot be used as scan targets.' });
    }

    const scan = await prismaClient.scan.create({
      data: {
        scanType,
        targetIdentifier,
        status: 'PENDING',
        organizationId: user.org
      }
    });

    const isWebsite = scanType === 'website';
    const payload = scannerRequestFor(scanType, targetIdentifier, user.org);

    try {
      const result = await callScanner(scannerEndpoint(isWebsite), payload);

      const safeFindings = sanitizeScannerFindings(result.findings, scanType);
      const updated = await prismaClient.scan.update({
        where: { id: scan.id },
        data: {
          status: 'COMPLETED',
          score: result.gdpr_compliance_percentage,
          riskLevel: result.risk_level,
          findingsJson: safeFindings,
          completedAt: new Date()
        }
      });
      
      // Redact for response if not premium
      let responseFindings = safeFindings;
      const org = await prismaClient.organization.findUnique({ where: { id: user.org } });
      if (org?.subscriptionStatus !== 'active') {
        responseFindings = freeFindingSummaries(responseFindings);
      }

      return scanResponse(updated, responseFindings);
    } catch (err) {
      const failed = await prismaClient.scan.update({
        where: { id: scan.id },
        data: {
          status: 'FAILED',
          findingsJson: [{ description: 'Scan could not be completed.' }],
          completedAt: new Date()
        }
      });
      request.log.warn(safeErrorMetadata(err), 'Authenticated scan failed');
      return reply.code(502).send({ ...scanResponse(failed), error: 'Scan could not be completed. Please try again.' });
    }
  });

  const ClaimScanSchema = { body: Type.Object({ claimToken: Type.String({ minLength: 64, maxLength: 64 }) }) };

  // A logged-in visitor may claim only an anonymous scan for which they still
  // possess the one-time browser token. The conditional update is atomic: a
  // competing request, expired token, or already-claimed scan matches zero
  // rows and cannot attach anything to an organisation.
  app.post('/api/scan/claim', { schema: ClaimScanSchema, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const user = request.user as any;
    const { claimToken } = request.body as { claimToken: string };
    const scan = await claimAnonymousScan(prismaClient, user.org, claimToken);
    if (!scan) return reply.code(400).send({ error: 'This free scan can no longer be claimed. Run a new scan from your dashboard.' });
    return scan;
  });

  // Delete a scan from the caller's own org. Previously the dashboard's
  // delete button only filtered client-side React state -- the row came
  // back on reload because nothing was ever deleted server-side.
  app.delete('/api/scan/:id', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    const existing = await prismaClient.scan.findFirst({
      where: { id, organizationId: user.org }
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Scan not found in your organization' });
    }

    await prismaClient.scan.delete({ where: { id } });
    return reply.status(204).send();
  });
}
