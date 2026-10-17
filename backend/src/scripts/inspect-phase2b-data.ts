import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspect() {
  console.log('========================================================================');
  console.log('=== KTEA CRM PHASE 2B: REAL DATA INSPECTION & RELATION AUDIT ===');
  console.log('========================================================================\n');

  // 1. Caretakers
  console.log('--- 1. CARETAKERS IN DATABASE ---');
  const caretakers = await prisma.caretaker.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      user: {
        select: { id: true, email: true, fullName: true, role: true, status: true }
      }
    }
  });
  caretakers.forEach((c, idx) => {
    console.log(`[Caregiver ${idx + 1}] ID: ${c.id} | Name: "${c.name}" | Active: ${c.active} | Linked User: ${c.user ? `${c.user.email} (${c.user.fullName}, Role: ${c.user.role})` : 'UNLINKED'}`);
  });

  // 2. Follow-ups grouped by assignedTo
  console.log('\n--- 2. HISTORICAL CUSTOMER-CAREGIVER RELATIONS IN FOLLOW-UPS ---');
  const followUpsByCaretaker = await prisma.followUp.groupBy({
    by: ['assignedTo'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });

  for (const group of followUpsByCaretaker) {
    const caregiverName = group.assignedTo || '(UNASSIGNED)';
    const distinctCustomers = await prisma.followUp.findMany({
      where: { assignedTo: group.assignedTo },
      select: { customerId: true },
      distinct: ['customerId']
    });
    console.log(`- Caregiver "${caregiverName}": ${distinctCustomers.length} distinct customers across ${group._count.id} schedules`);
  }

  // Check if any customer has follow-ups with multiple caregivers
  const customerCaregiverPairs = await prisma.followUp.findMany({
    where: { assignedTo: { not: null } },
    select: { customerId: true, assignedTo: true },
    distinct: ['customerId', 'assignedTo']
  });
  const customerMap = new Map<string, string[]>();
  customerCaregiverPairs.forEach(p => {
    const list = customerMap.get(p.customerId) || [];
    list.push(p.assignedTo!);
    customerMap.set(p.customerId, list);
  });
  const multiCaregiverCustomers = Array.from(customerMap.entries()).filter(([_, caregivers]) => caregivers.length > 1);
  console.log(`\nCustomers with multiple different caregivers in history: ${multiCaregiverCustomers.length}`);
  multiCaregiverCustomers.slice(0, 5).forEach(([cId, caregivers]) => {
    console.log(`  - Customer ${cId}: Caregivers [${caregivers.join(', ')}]`);
  });

  // 3. Check customer table schema / fields
  console.log('\n--- 3. CHECK CUSTOMER FIELDS & POTENTIAL DIRECT RELATIONS ---');
  const sampleCustomer = await prisma.customer.findFirst();
  console.log('Customer model fields:', sampleCustomer ? Object.keys(sampleCustomer) : 'none');

  // Check customer tags or notes or other models
  const tagsCount = await prisma.customerTag.count();
  const notesCount = await prisma.customerNote.count();
  const activitiesCount = await prisma.customerActivity.count();
  console.log(`- Customer Tags count: ${tagsCount}`);
  console.log(`- Customer Notes count: ${notesCount}`);
  console.log(`- Customer Activities count: ${activitiesCount}`);

  // Check activities to see if caregiver is mentioned
  const sampleActivities = await prisma.customerActivity.findMany({
    take: 5,
    select: { id: true, type: true, description: true }
  });
  console.log('Sample activities:', sampleActivities);

  // 4. Users in DB
  console.log('\n--- 4. USERS IN DATABASE ---');
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      status: true,
      caretaker: { select: { id: true, name: true } },
      _count: { select: { assignedCustomers: true, receivedGrants: true } }
    }
  });
  users.forEach((u, idx) => {
    console.log(`[User ${idx + 1}] ID: ${u.id} | Email: ${u.email} | Name: ${u.fullName} | Role: ${u.role} | Status: ${u.status} | Linked Caregiver: ${u.caretaker ? `"${u.caretaker.name}" (${u.caretaker.id})` : 'NONE'} | Assignments: ${u._count.assignedCustomers} | Grants: ${u._count.receivedGrants}`);
  });

  // 5. Existing assignments
  console.log('\n--- 5. EXISTING CUSTOMER ASSIGNMENTS ---');
  const assignments = await prisma.customerAssignment.findMany({
    include: {
      user: { select: { email: true, fullName: true } },
      customer: { select: { fullName: true, phone: true } }
    }
  });
  console.log(`Total active materialized assignments: ${assignments.length}`);
  assignments.forEach((a, idx) => {
    console.log(`  [Assignment ${idx + 1}] User: ${a.user.email} -> Customer: "${a.customer.fullName}" (${a.customerId})`);
  });

  // 6. Existing grants
  console.log('\n--- 6. EXISTING CUSTOMER ASSIGNMENT GRANTS ---');
  const grants = await prisma.customerAssignmentGrant.findMany({
    include: {
      user: { select: { email: true } }
    }
  });
  console.log(`Total assignment grants: ${grants.length}`);
  grants.forEach((g, idx) => {
    console.log(`  [Grant ${idx + 1}] User: ${g.user.email} -> Customer: ${g.customerId} | Source: ${g.sourceType} (${g.sourceId}) | Active: ${g.active}`);
  });

  console.log('\n========================================================================');
}

inspect()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
