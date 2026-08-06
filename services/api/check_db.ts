import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'admin@privacyready.co.uk' } })
  console.log(user)
}
main().catch(console.error).finally(() => prisma.$disconnect())
