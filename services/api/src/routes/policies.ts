import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { prisma } from '../db.js';
import { requireActiveSubscription } from '../entitlement.js';

type PolicyPrisma = Pick<typeof prisma, 'user' | 'organization'>;
const PolicySchema = { body: Type.Object({ businessName: Type.String({ minLength: 2, maxLength: 200 }), contactEmail: Type.String({ format: 'email', maxLength: 254 }), dataTypes: Type.String({ minLength: 2, maxLength: 2000 }), thirdParties: Type.String({ minLength: 2, maxLength: 2000 }), retentionMonths: Type.Integer({ minimum: 1, maximum: 120 }) }) };

export async function registerPolicyRoutes(app: FastifyInstance, dependencies: { prismaClient?: PolicyPrisma } = {}) {
  const prismaClient = dependencies.prismaClient ?? prisma;
  app.post('/api/policies/generate', { schema: PolicySchema, preHandler: (request, reply) => requireActiveSubscription(request, reply, prismaClient) }, async (request) => {
    const { businessName, contactEmail, dataTypes, thirdParties, retentionMonths } = request.body as any;
    const policy = `# UK GDPR PRIVACY POLICY FOR ${businessName.toUpperCase()}\n\n1. DATA CONTROLLER\n${businessName} (Contact: ${contactEmail}) is committed to protecting personal data under UK GDPR and the Data Protection Act 2018.\n\n2. DATA COLLECTED\nThe following personal data categories were supplied for this draft: ${dataTypes}.\n\n3. THIRD-PARTY PROCESSORS\nThe following processors were supplied for this draft: ${thirdParties}.\n\n4. DATA RETENTION\nThe supplied retention period is ${retentionMonths} months.\n\n5. INDIVIDUAL RIGHTS\nRequests concerning personal data can be sent to ${contactEmail}.\n\nThis working draft was generated from information supplied by the organisation and does not guarantee legal compliance.`;
    return { policy };
  });
}
