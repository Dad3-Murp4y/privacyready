import bcrypt from 'bcrypt';
import { prisma } from '../src/db.js';

const email = 'demo@privacyready.co.uk';
const orgName = 'DQVentures';

async function main() {
  if (process.env.NODE_ENV !== 'staging' || process.env.STAGING_DEMO_BOOTSTRAP !== 'true') {
    throw new Error('Refusing demo bootstrap: NODE_ENV=staging and STAGING_DEMO_BOOTSTRAP=true are both required.');
  }
  const password = process.env.DEMO_ACCOUNT_PASSWORD;
  const suppliedHash = process.env.DEMO_ACCOUNT_PASSWORD_HASH;
  if ((!password && !suppliedHash) || (password && suppliedHash)) {
    throw new Error('Set exactly one of DEMO_ACCOUNT_PASSWORD or DEMO_ACCOUNT_PASSWORD_HASH; neither is ever logged.');
  }
  if (suppliedHash && !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(suppliedHash)) {
    throw new Error('DEMO_ACCOUNT_PASSWORD_HASH must be a bcrypt cost-12 hash.');
  }
  const passwordHash = suppliedHash ?? await bcrypt.hash(password!, 12);
  let org = await prisma.organization.findFirst({ where: { name: orgName }, orderBy: { createdAt: 'asc' } });
  if (!org) org = await prisma.organization.create({ data: { name: orgName } });
  await prisma.user.upsert({
    where: { email },
    update: { fullName: 'Test User', organizationId: org.id, role: 'ADMIN', emailVerified: true, emailVerifyTokenHash: null, emailVerifyExpires: null, passwordHash },
    create: { email, fullName: 'Test User', organizationId: org.id, role: 'ADMIN', emailVerified: true, passwordHash }
  });
  await prisma.$disconnect();
}

main().catch(async (error) => { await prisma.$disconnect(); console.error(error instanceof Error ? error.message : 'Demo bootstrap failed'); process.exitCode = 1; });
