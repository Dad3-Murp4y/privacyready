import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { prisma } from '../db.js';

export async function registerScanRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    // Only protect /api/scan (but not /api/public)
    if (!request.url.startsWith('/api/scan') || request.url.startsWith('/api/public')) {
      return;
    }
    
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  const CreateScanSchema = {
    body: Type.Object({
      targetIdentifier: Type.String(),
      scanType: Type.String()
    })
  };

  // Unauthenticated endpoint for landing page
  app.post('/api/public/scan', { schema: CreateScanSchema }, async (request, reply) => {
    const { targetIdentifier, scanType } = request.body as any;

    const scan = await prisma.scan.create({
      data: {
        scanType,
        targetIdentifier,
        status: 'PENDING'
        // organizationId is left null
      }
    });

    const isWebsite = scanType.toLowerCase() === 'website';
    const scannerEndpoint = isWebsite 
      ? 'http://scanner.privacyready.local:8080/v1/scan/website' 
      : 'http://scanner.privacyready.local:8080/v1/scan/social';

    const payload = isWebsite
      ? { customer_id: 'guest', url: targetIdentifier }
      : { 
          customer_id: 'guest', 
          tiktok_username: targetIdentifier
        };

    try {
      const response = await fetch(scannerEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
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
      return updated;
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


  app.get('/api/scan', async (request, reply) => {
    const user = request.user as any;
    const scans = await prisma.scan.findMany({
      where: { organizationId: user.org },
      orderBy: { createdAt: 'desc' }
    });
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

    const isWebsite = scanType.toLowerCase() === 'website';
    const scannerEndpoint = isWebsite 
      ? 'http://scanner.privacyready.local:8080/v1/scan/website' 
      : 'http://scanner.privacyready.local:8080/v1/scan/social';

    const payload = isWebsite
      ? { customer_id: user.org, url: targetIdentifier }
      : { 
          customer_id: user.org, 
          tiktok_username: targetIdentifier
        };

    try {
      const response = await fetch(scannerEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
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
      return updated;
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
}
