import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const email = 'christian.watts73@yahoo.com';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`User ${email} not found.`);
    return;
  }
  
  await prisma.user.update({
    where: { email },
    data: { emailVerified: true, emailVerifyTokenHash: null, emailVerifyExpires: null }
  });
  console.log(`Successfully verified user ${email}!`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
