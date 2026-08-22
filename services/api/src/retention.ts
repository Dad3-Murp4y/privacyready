import { prisma } from './db.js';

export const RETENTION_POLICY = Object.freeze({
  organizationRecoveryDays: 30,
  scanMonths: 12,
  anonymousScanGraceHours: 24,
  closedDsrMonths: 24,
});

export type RetentionPrisma = Pick<typeof prisma, 'organization' | 'scan' | 'dsrRequest' | 'user' | '$transaction'>;

export type RetentionReport = {
  mode: 'dry-run' | 'execute';
  generatedAt: string;
  eligible: {
    organizations: number;
    scans: number;
    anonymousScans: number;
    closedDsrRequests: number;
    expiredVerificationTokens: number;
    expiredPasswordResetTokens: number;
  };
  affected?: RetentionReport['eligible'];
};

function subtractMonths(now: Date, months: number): Date {
  const result = new Date(now);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() - months);
  const lastDayOfTargetMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result;
}

function subtractMilliseconds(now: Date, milliseconds: number): Date {
  return new Date(now.getTime() - milliseconds);
}

export function retentionCutoffs(now = new Date()) {
  return {
    organization: subtractMilliseconds(now, RETENTION_POLICY.organizationRecoveryDays * 24 * 60 * 60 * 1000),
    scan: subtractMonths(now, RETENTION_POLICY.scanMonths),
    anonymousScan: subtractMilliseconds(now, RETENTION_POLICY.anonymousScanGraceHours * 60 * 60 * 1000),
    closedDsr: subtractMonths(now, RETENTION_POLICY.closedDsrMonths),
    token: now,
  };
}

export function retentionFilters(now = new Date()) {
  const cutoff = retentionCutoffs(now);
  return {
    organizations: { deletionRequestedAt: { not: null, lte: cutoff.organization } },
    scans: { organizationId: { not: null }, createdAt: { lte: cutoff.scan } },
    anonymousScans: {
      organizationId: null,
      claimTokenExpires: { not: null, lte: cutoff.anonymousScan },
    },
    closedDsrRequests: {
      status: { in: ['COMPLETED', 'REJECTED'] },
      resolvedAt: { not: null, lte: cutoff.closedDsr },
    },
    expiredVerificationTokens: {
      emailVerifyTokenHash: { not: null },
      emailVerifyExpires: { not: null, lte: cutoff.token },
    },
    expiredPasswordResetTokens: {
      passwordResetTokenHash: { not: null },
      passwordResetExpires: { not: null, lte: cutoff.token },
    },
  };
}

export function retentionExecutionRequested(args: readonly string[], confirmation: string | undefined): boolean {
  const execute = args.includes('--execute');
  if (execute && confirmation !== 'DELETE_ELIGIBLE_RECORDS') {
    throw new Error('Execution requires RETENTION_EXECUTION_CONFIRMED=DELETE_ELIGIBLE_RECORDS. Run without --execute for a dry-run report.');
  }
  return execute;
}

async function eligibleCounts(prismaClient: RetentionPrisma, now: Date): Promise<RetentionReport['eligible']> {
  const filters = retentionFilters(now);
  const [organizations, scans, anonymousScans, closedDsrRequests, expiredVerificationTokens, expiredPasswordResetTokens] = await Promise.all([
    prismaClient.organization.count({ where: filters.organizations }),
    prismaClient.scan.count({ where: filters.scans }),
    prismaClient.scan.count({ where: filters.anonymousScans }),
    prismaClient.dsrRequest.count({ where: filters.closedDsrRequests }),
    prismaClient.user.count({ where: filters.expiredVerificationTokens }),
    prismaClient.user.count({ where: filters.expiredPasswordResetTokens }),
  ]);
  return { organizations, scans, anonymousScans, closedDsrRequests, expiredVerificationTokens, expiredPasswordResetTokens };
}

export async function runRetention(
  prismaClient: RetentionPrisma = prisma,
  options: { execute?: boolean; now?: Date } = {},
): Promise<RetentionReport> {
  const now = options.now ?? new Date();
  const eligible = await eligibleCounts(prismaClient, now);
  if (!options.execute) {
    return { mode: 'dry-run', generatedAt: now.toISOString(), eligible };
  }

  const filters = retentionFilters(now);
  const affected = await prismaClient.$transaction(async (tx) => {
    const verification = await tx.user.updateMany({
      where: filters.expiredVerificationTokens,
      data: { emailVerifyTokenHash: null, emailVerifyExpires: null },
    });
    const passwordReset = await tx.user.updateMany({
      where: filters.expiredPasswordResetTokens,
      data: { passwordResetTokenHash: null, passwordResetExpires: null },
    });
    const scans = await tx.scan.deleteMany({ where: filters.scans });
    const anonymousScans = await tx.scan.deleteMany({ where: filters.anonymousScans });
    const closedDsrRequests = await tx.dsrRequest.deleteMany({ where: filters.closedDsrRequests });
    const organizations = await tx.organization.deleteMany({ where: filters.organizations });
    return {
      organizations: organizations.count,
      scans: scans.count,
      anonymousScans: anonymousScans.count,
      closedDsrRequests: closedDsrRequests.count,
      expiredVerificationTokens: verification.count,
      expiredPasswordResetTokens: passwordReset.count,
    };
  });

  return { mode: 'execute', generatedAt: now.toISOString(), eligible, affected };
}
