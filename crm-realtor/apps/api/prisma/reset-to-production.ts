/**
 * RESET TO PRODUCTION
 *
 * Use after demo: wipes all seeded demo data (clients, properties, leads,
 * tasks, deals, showings, activities, messages) but keeps the admin user
 * and core configuration (sources, templates).
 *
 * After running this the agency starts from a clean slate — they can create
 * real users via /admin/users and start adding real clients.
 *
 *   pnpm --filter @crm/api exec tsx prisma/reset-to-production.ts
 *
 * DESTRUCTIVE — requires explicit confirmation flag:
 *   --yes-i-really-want-to-wipe-demo-data
 */
import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

async function main() {
  const flagPassed = process.argv.includes('--yes-i-really-want-to-wipe-demo-data');

  if (!flagPassed) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) => {
      rl.question(
        '\n⚠️  This will DELETE all clients, leads, properties, deals, activities, tasks, showings.\n' +
        '   Admin user and configuration (sources, templates) will be preserved.\n' +
        '   Type "WIPE" to confirm: ',
        resolve,
      );
    });
    rl.close();
    if (answer.trim() !== 'WIPE') {
      console.log('Cancelled. Nothing changed.');
      process.exit(0);
    }
  }

  console.log('\nWiping demo data...');

  // Delete order respects FK constraints:
  // payments → deals → showings/tasks/activities → leads → clients → properties
  // Non-data tables (sources, templates, automation_rules, audit_log) stay.
  await prisma.$transaction([
    prisma.payment.deleteMany({}),
    prisma.deal.deleteMany({}),
    prisma.document.deleteMany({}),
    prisma.notification.deleteMany({}),
    prisma.task.deleteMany({}),
    prisma.showing.deleteMany({}),
    prisma.message.deleteMany({}),
    prisma.activity.deleteMany({}),
    prisma.lead.deleteMany({}),
    prisma.clientContact.deleteMany({}),
    prisma.clientPreferences.deleteMany({}),
    prisma.client.deleteMany({}),
    prisma.propertyPhoto.deleteMany({}),
    prisma.property.deleteMany({}),
  ]);

  // Drop all users except the original admin.
  await prisma.user.deleteMany({
    where: { email: { not: 'admin@crm.local' } },
  });

  console.log('✅ Done. Database is clean.');
  console.log('   Only admin@crm.local remains as user.');
  console.log('   Add real agents via /admin/users.');
}

main()
  .catch((e) => {
    console.error('Reset failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
