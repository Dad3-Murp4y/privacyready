import { prisma } from '../src/db.js';
import { retentionExecutionRequested, runRetention } from '../src/retention.js';

const execute = retentionExecutionRequested(process.argv.slice(2), process.env.RETENTION_EXECUTION_CONFIRMED);

try {
  const report = await runRetention(prisma, { execute });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await prisma.$disconnect();
}
