import {
  PrismaClient,
  Gender,
  CustomerStatus,
  PriorityLevel,
  NeedStatus,
  CaseStatus,
  ActivityType,
  FollowUpStatus,
  RecommendationStatus,
  PushStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed with synthetic demo data...');

  // 1. Clean existing records in foreign-key safe order
  await prisma.pushRecord.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.customerTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.customerNote.deleteMany();
  await prisma.customerActivity.deleteMany();
  await prisma.customerCase.deleteMany();
  await prisma.customerNeed.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();

  console.log('✓ Cleaned existing database tables.');
  return; // Stop after cleanup, no mock data seeded

  // 2. Seed Products
  const productsData = [
    {
      code: 'CC_CASHBACK_TITANIUM',
      name: 'Titanium Cashback Credit Card',
      description: 'Zero annual fee credit card with 5% cashback on everyday groceries and fuel.',
      active: true,
    },
    {
      code: 'CC_MILES_PLATINUM',
      name: 'Platinum Travel Miles Card',
      description: 'Premium travel credit card with comprehensive airport lounge access and 2x air miles.',
      active: true,
    },
    {
      code: 'LOAN_PERSONAL_UNSECURED',
      name: 'Flexi Personal Unsecured Loan',
      description: 'Quick disbursement personal cash loan up to 300M VND with 12 to 48 months tenure.',
      active: true,
    },
    {
      code: 'LOAN_SME_WORKING_CAPITAL',
      name: 'SME Revolving Credit Line',
      description: 'Working capital credit facility designed for small business inventory and cash flow.',
      active: true,
    },
    {
      code: 'LOAN_MORTGAGE_RESIDENTIAL',
      name: 'Prime Residential Home Loan',
      description: 'Long-term home purchase financing with preferential fixed interest for the first 24 months.',
      active: true,
    },
    {
      code: 'WEALTH_TERM_DEPOSIT_PLUS',
      name: 'Wealth Horizon Term Deposit',
      description: 'Fixed term savings product offering progressive tiered interest rates for high balances.',
      active: true,
    },
    {
      code: 'OTHER_MERCHANT_POS',
      name: 'Smart Retail POS & Payment Solution',
      description: 'All-in-one payment acceptance terminal and QR merchant settlement package.',
      active: true,
    },
  ];

  const createdProducts = await Promise.all(
    productsData.map((prod) =>
      prisma.product.create({
        data: prod,
      })
    )
  );
  console.log(`✓ Seeded ${createdProducts.length} product catalog entries.`);

  const productMap = new Map(createdProducts.map((p) => [p.code, p]));

  // 3. Seed Tags
  const tagsData = [
    { name: 'VIP_AFFLUENT', color: '#3b82f6' },
    { name: 'SME_BUSINESS_OWNER', color: '#10b981' },
    { name: 'HIGH_INCOME', color: '#8b5cf6' },
    { name: 'PRICE_SENSITIVE', color: '#f59e0b' },
    { name: 'CARD_DECLINED_RECOVERY', color: '#ef4444' },
    { name: 'URGENT_CAPITAL_NEED', color: '#ec4899' },
    { name: 'PREFERRED_MORNING_CALL', color: '#6366f1' },
    { name: 'DIGITAL_SAVVY', color: '#14b8a6' },
  ];

  const createdTags = await Promise.all(
    tagsData.map((t) =>
      prisma.tag.create({
        data: t,
      })
    )
  );
  console.log(`✓ Seeded ${createdTags.length} operational tags.`);

  // 4. Seed 35 Synthetic Vietnamese Customers
  const syntheticCustomersData = [
    { fullName: 'Nguyen Van Demo 01', phone: '0901000001', email: 'demo01.nguyen@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1988-04-12'), address: 'District 1, Ho Chi Minh City', source: 'INBOUND_WEB', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.HIGH },
    { fullName: 'Tran Thi Demo 02', phone: '0901000002', email: 'demo02.tran@synthetic.vn', gender: Gender.FEMALE, dateOfBirth: new Date('1992-09-25'), address: 'Ba Dinh District, Ha Noi', source: 'REFERRAL', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.URGENT },
    { fullName: 'Le Hoang Demo 03', phone: '0901000003', email: 'demo03.le@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1985-11-03'), address: 'Hai Chau District, Da Nang', source: 'PARTNER_BROKER', overallStatus: CustomerStatus.PROSPECT, priority: PriorityLevel.MEDIUM },
    { fullName: 'Pham Minh Demo 04', phone: '0901000004', email: 'demo04.pham@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1990-01-18'), address: 'District 7, Ho Chi Minh City', source: 'CAMPAIGN_FACEBOOK', overallStatus: CustomerStatus.LEAD, priority: PriorityLevel.LOW },
    { fullName: 'Hoang Thu Demo 05', phone: '0901000005', email: 'demo05.hoang@synthetic.vn', gender: Gender.FEMALE, dateOfBirth: new Date('1994-07-30'), address: 'Cau Giay District, Ha Noi', source: 'INBOUND_WEB', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.HIGH },
    { fullName: 'Vu Duc Demo 06', phone: '0901000006', email: 'demo06.vu@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1982-03-15'), address: 'Thu Duc City, Ho Chi Minh City', source: 'REFERRAL', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.URGENT },
    { fullName: 'Doan Thi Demo 07', phone: '0901000007', email: 'demo07.doan@synthetic.vn', gender: Gender.FEMALE, dateOfBirth: new Date('1996-12-05'), address: 'Dong Da District, Ha Noi', source: 'CAMPAIGN_GOOGLE', overallStatus: CustomerStatus.PROSPECT, priority: PriorityLevel.MEDIUM },
    { fullName: 'Bui Quang Demo 08', phone: '0901000008', email: 'demo08.bui@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1987-08-22'), address: 'Ngo Quyen District, Hai Phong', source: 'PARTNER_BROKER', overallStatus: CustomerStatus.DORMANT, priority: PriorityLevel.LOW },
    { fullName: 'Dinh Ngoc Demo 09', phone: '0901000009', email: 'demo09.dinh@synthetic.vn', gender: Gender.FEMALE, dateOfBirth: new Date('1991-05-14'), address: 'District 3, Ho Chi Minh City', source: 'INBOUND_PHONE', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.HIGH },
    { fullName: 'Ngo Tuan Demo 10', phone: '0901000010', email: 'demo10.ngo@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1989-10-09'), address: 'Thanh Xuan District, Ha Noi', source: 'REFERRAL', overallStatus: CustomerStatus.PROSPECT, priority: PriorityLevel.MEDIUM },
    { fullName: 'Duong Cam Demo 11', phone: '0901000011', email: 'demo11.duong@synthetic.vn', gender: Gender.FEMALE, dateOfBirth: new Date('1995-02-28'), address: 'District 10, Ho Chi Minh City', source: 'CAMPAIGN_TIKTOK', overallStatus: CustomerStatus.LEAD, priority: PriorityLevel.LOW },
    { fullName: 'Ly Quoc Demo 12', phone: '0901000012', email: 'demo12.ly@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1980-06-19'), address: 'Son Tra District, Da Nang', source: 'ORGANIC_EVENT', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.URGENT },
    { fullName: 'Mai Phuong Demo 13', phone: '0901000013', email: 'demo13.mai@synthetic.vn', gender: Gender.FEMALE, dateOfBirth: new Date('1993-04-07'), address: 'Tay Ho District, Ha Noi', source: 'INBOUND_WEB', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.MEDIUM },
    { fullName: 'Ha Van Demo 14', phone: '0901000014', email: 'demo14.ha@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1986-11-23'), address: 'Binh Thanh District, Ho Chi Minh City', source: 'REFERRAL', overallStatus: CustomerStatus.PROSPECT, priority: PriorityLevel.HIGH },
    { fullName: 'Truong Bich Demo 15', phone: '0901000015', email: 'demo15.truong@synthetic.vn', gender: Gender.FEMALE, dateOfBirth: new Date('1997-08-11'), address: 'Hoan Kiem District, Ha Noi', source: 'CAMPAIGN_FACEBOOK', overallStatus: CustomerStatus.LEAD, priority: PriorityLevel.LOW },
    { fullName: 'Lam Gia Demo 16', phone: '0901000016', email: 'demo16.lam@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1984-01-30'), address: 'Ninh Kieu District, Can Tho', source: 'PARTNER_BROKER', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.HIGH },
    { fullName: 'Phan Anh Demo 17', phone: '0901000017', email: 'demo17.phan@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1990-12-14'), address: 'District 5, Ho Chi Minh City', source: 'INBOUND_WEB', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.URGENT },
    { fullName: 'Vo My Demo 18', phone: '0901000018', email: 'demo18.vo@synthetic.vn', gender: Gender.FEMALE, dateOfBirth: new Date('1992-03-21'), address: 'Long Bien District, Ha Noi', source: 'REFERRAL', overallStatus: CustomerStatus.PROSPECT, priority: PriorityLevel.MEDIUM },
    { fullName: 'Trinh Cong Demo 19', phone: '0901000019', email: 'demo19.trinh@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1983-09-08'), address: 'Thu Dau Mot, Binh Duong', source: 'ORGANIC_EVENT', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.HIGH },
    { fullName: 'Kieu Thanh Demo 20', phone: '0901000020', email: 'demo20.kieu@synthetic.vn', gender: Gender.FEMALE, dateOfBirth: new Date('1994-05-17'), address: 'District 2, Thu Duc City', source: 'CAMPAIGN_GOOGLE', overallStatus: CustomerStatus.LEAD, priority: PriorityLevel.LOW },
    { fullName: 'Dang Khac Demo 21', phone: '0901000021', email: 'demo21.dang@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1988-10-29'), address: 'Ha Dong District, Ha Noi', source: 'INBOUND_PHONE', overallStatus: CustomerStatus.DORMANT, priority: PriorityLevel.LOW },
    { fullName: 'Nghiem Xuan Demo 22', phone: '0901000022', email: 'demo22.nghiem@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1979-07-04'), address: 'Tan Binh District, Ho Chi Minh City', source: 'PARTNER_BROKER', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.URGENT },
    { fullName: 'Luu Huong Demo 23', phone: '0901000023', email: 'demo23.luu@synthetic.vn', gender: Gender.FEMALE, dateOfBirth: new Date('1995-11-12'), address: 'Bac Tu Liem District, Ha Noi', source: 'INBOUND_WEB', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.HIGH },
    { fullName: 'Thai Bao Demo 24', phone: '0901000024', email: 'demo24.thai@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1987-02-16'), address: 'District 4, Ho Chi Minh City', source: 'REFERRAL', overallStatus: CustomerStatus.PROSPECT, priority: PriorityLevel.MEDIUM },
    { fullName: 'Ta Nhu Demo 25', phone: '0901000025', email: 'demo25.ta@synthetic.vn', gender: Gender.FEMALE, dateOfBirth: new Date('1993-06-27'), address: 'Thanh Khe District, Da Nang', source: 'CAMPAIGN_FACEBOOK', overallStatus: CustomerStatus.LOST, priority: PriorityLevel.LOW },
    { fullName: 'On Gia Demo 26', phone: '0901000026', email: 'demo26.on@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1985-08-01'), address: 'Phu Nhuan District, Ho Chi Minh City', source: 'INBOUND_WEB', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.HIGH },
    { fullName: 'Quach Tieu Demo 27', phone: '0901000027', email: 'demo27.quach@synthetic.vn', gender: Gender.FEMALE, dateOfBirth: new Date('1991-01-20'), address: 'Nam Tu Liem District, Ha Noi', source: 'REFERRAL', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.URGENT },
    { fullName: 'Chau Vinh Demo 28', phone: '0901000028', email: 'demo28.chau@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1981-12-10'), address: 'Bien Hoa, Dong Nai', source: 'PARTNER_BROKER', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.HIGH },
    { fullName: 'Khuat Van Demo 29', phone: '0901000029', email: 'demo29.khuat@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1989-04-05'), address: 'Hoang Mai District, Ha Noi', source: 'CAMPAIGN_GOOGLE', overallStatus: CustomerStatus.PROSPECT, priority: PriorityLevel.MEDIUM },
    { fullName: 'Tu Kim Demo 30', phone: '0901000030', email: 'demo30.tu@synthetic.vn', gender: Gender.FEMALE, dateOfBirth: new Date('1996-09-15'), address: 'District 8, Ho Chi Minh City', source: 'INBOUND_WEB', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.HIGH },
    { fullName: 'Nong Duc Demo 31', phone: '0901000031', email: 'demo31.nong@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1986-03-31'), address: 'Dong Anh District, Ha Noi', source: 'REFERRAL', overallStatus: CustomerStatus.LEAD, priority: PriorityLevel.LOW },
    { fullName: 'Luc Thuy Demo 32', phone: '0901000032', email: 'demo32.luc@synthetic.vn', gender: Gender.FEMALE, dateOfBirth: new Date('1994-10-22'), address: 'District 11, Ho Chi Minh City', source: 'INBOUND_PHONE', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.MEDIUM },
    { fullName: 'Nham Manh Demo 33', phone: '0901000033', email: 'demo33.nham@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1982-05-09'), address: 'Le Chan District, Hai Phong', source: 'PARTNER_BROKER', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.URGENT },
    { fullName: 'Thieu Mai Demo 34', phone: '0901000034', email: 'demo34.thieu@synthetic.vn', gender: Gender.FEMALE, dateOfBirth: new Date('1990-07-13'), address: 'Binh Tan District, Ho Chi Minh City', source: 'CAMPAIGN_FACEBOOK', overallStatus: CustomerStatus.PROSPECT, priority: PriorityLevel.MEDIUM },
    { fullName: 'Giap Van Demo 35', phone: '0901000035', email: 'demo35.giap@synthetic.vn', gender: Gender.MALE, dateOfBirth: new Date('1983-11-28'), address: 'Gia Lam District, Ha Noi', source: 'ORGANIC_EVENT', overallStatus: CustomerStatus.ACTIVE, priority: PriorityLevel.HIGH },
  ];

  const createdCustomers = await Promise.all(
    syntheticCustomersData.map((c) =>
      prisma.customer.create({
        data: c,
      })
    )
  );
  console.log(`✓ Seeded ${createdCustomers.length} synthetic customer profiles.`);

  // 5. Associate Tags with Customers
  for (let i = 0; i < createdCustomers.length; i++) {
    const cust = createdCustomers[i];
    const tagsToAssign = [createdTags[i % createdTags.length]];
    if (i % 2 === 0) {
      tagsToAssign.push(createdTags[(i + 3) % createdTags.length]);
    }
    for (const tag of tagsToAssign) {
      await prisma.customerTag.create({
        data: {
          customerId: cust.id,
          tagId: tag.id,
        },
      });
    }
  }
  console.log('✓ Seeded customer tags relationships.');

  // 6. Seed Customer Needs
  const needTypes = ['CREDIT_CARD', 'PERSONAL_LOAN', 'SME_WORKING_CAPITAL', 'HOME_PURCHASE', 'SAVINGS_YIELD', 'PAYMENT_POS'];
  for (let i = 0; i < createdCustomers.length; i++) {
    const cust = createdCustomers[i];
    // Each customer has 1 or 2 needs
    await prisma.customerNeed.create({
      data: {
        customerId: cust.id,
        needType: needTypes[i % needTypes.length],
        status: i % 4 === 0 ? NeedStatus.RESOLVED : NeedStatus.OPEN,
        notes: `Customer expressed interest in ${needTypes[i % needTypes.length]} during initial phone qualification.`,
        detectedAt: new Date(Date.now() - (i + 1) * 86400000 * 3),
        resolvedAt: i % 4 === 0 ? new Date() : null,
      },
    });

    if (i % 3 === 0) {
      await prisma.customerNeed.create({
        data: {
          customerId: cust.id,
          needType: needTypes[(i + 2) % needTypes.length],
          status: NeedStatus.IN_PROGRESS,
          notes: `Secondary need identified: seeking capital for expanding local store operations.`,
          detectedAt: new Date(Date.now() - (i + 2) * 86400000 * 2),
        },
      });
    }
  }
  console.log('✓ Seeded customer needs.');

  // 7. Seed Customer Cases (Illustrating: Customer != Application/Case)
  // Customer 01 applied for Card, REJECTED due to income doc, later applied for Personal Loan and was APPROVED!
  const cardTitanium = productMap.get('CC_CASHBACK_TITANIUM')!;
  const loanPersonal = productMap.get('LOAN_PERSONAL_UNSECURED')!;
  const loanSme = productMap.get('LOAN_SME_WORKING_CAPITAL')!;
  const cardPlatinum = productMap.get('CC_MILES_PLATINUM')!;
  const homeLoan = productMap.get('LOAN_MORTGAGE_RESIDENTIAL')!;

  // Case history for Customer 01: Multi-application lifecycle
  await prisma.customerCase.create({
    data: {
      customerId: createdCustomers[0].id,
      productId: cardTitanium.id,
      caseStatus: CaseStatus.REJECTED,
      applicationDate: new Date('2026-06-10'),
      resultDate: new Date('2026-06-18'),
      failureReason: 'Income verification documents lacked company stamp confirmation.',
      notes: 'Initial credit card application declined at underwriting stage.',
    },
  });

  await prisma.customerCase.create({
    data: {
      customerId: createdCustomers[0].id,
      productId: loanPersonal.id,
      caseStatus: CaseStatus.APPROVED,
      applicationDate: new Date('2026-08-01'),
      resultDate: new Date('2026-08-07'),
      notes: 'Customer provided tax declaration and personal bank statements. Approved 150M VND.',
    },
  });

  // Populate cases across other customers
  for (let i = 1; i < createdCustomers.length; i++) {
    const cust = createdCustomers[i];
    const prod = createdProducts[i % createdProducts.length];
    const statuses = [CaseStatus.SUBMITTED, CaseStatus.UNDER_REVIEW, CaseStatus.APPROVED, CaseStatus.REJECTED];
    const chosenStatus = statuses[i % statuses.length];

    await prisma.customerCase.create({
      data: {
        customerId: cust.id,
        productId: prod.id,
        caseStatus: chosenStatus,
        applicationDate: new Date(Date.now() - (i * 2 + 5) * 86400000),
        resultDate: chosenStatus === CaseStatus.APPROVED || chosenStatus === CaseStatus.REJECTED ? new Date() : null,
        failureReason: chosenStatus === CaseStatus.REJECTED ? 'High debt-to-income ratio based on credit bureau report.' : null,
        notes: `Application case for product ${prod.code}. Operator tracking record.`,
      },
    });

    // Customer 06 also has 2 cases (SME Loan & POS)
    if (i === 5) {
      await prisma.customerCase.create({
        data: {
          customerId: cust.id,
          productId: loanSme.id,
          caseStatus: CaseStatus.UNDER_REVIEW,
          applicationDate: new Date('2026-09-15'),
          notes: 'Submitting collateral deeds for 500M SME credit line review.',
        },
      });
    }
  }
  console.log('✓ Seeded customer application cases.');

  // 8. Seed Customer Activities (Strict Append-Only Event Log)
  const activityTypes = [ActivityType.CALL, ActivityType.MESSAGE, ActivityType.MEETING, ActivityType.NOTE, ActivityType.SYSTEM_EVENT];
  for (let i = 0; i < createdCustomers.length; i++) {
    const cust = createdCustomers[i];
    await prisma.customerActivity.create({
      data: {
        customerId: cust.id,
        type: activityTypes[i % activityTypes.length],
        title: `Outreach Interaction #${i + 1}`,
        description: `Conducted phone discovery. Verified customer current employment and financial plans.`,
        occurredAt: new Date(Date.now() - (i + 1) * 86400000),
      },
    });

    if (i % 2 === 0) {
      await prisma.customerActivity.create({
        data: {
          customerId: cust.id,
          type: ActivityType.SYSTEM_EVENT,
          title: 'Case Status Synchronized',
          description: 'Application moved from SUBMITTED to UNDER_REVIEW.',
          occurredAt: new Date(Date.now() - (i + 2) * 43200000),
        },
      });
    }
  }
  console.log('✓ Seeded customer activities.');

  // 9. Seed Customer Notes
  for (let i = 0; i < createdCustomers.length; i++) {
    const cust = createdCustomers[i];
    await prisma.customerNote.create({
      data: {
        customerId: cust.id,
        content: `Operator note: Customer prefers communication via Zalo / phone call before 11:30 AM. Interested in low fee structures.`,
      },
    });
  }
  console.log('✓ Seeded customer qualitative notes.');

  // 10. Seed Follow-ups (Due today, overdue, future, completed)
  for (let i = 0; i < createdCustomers.length; i++) {
    const cust = createdCustomers[i];
    let dueAtDate: Date;
    let status: FollowUpStatus;
    let completedAt: Date | null = null;

    if (i % 4 === 0) {
      // Overdue
      dueAtDate = new Date(Date.now() - 86400000 * 2);
      status = FollowUpStatus.PENDING;
    } else if (i % 4 === 1) {
      // Due today
      dueAtDate = new Date(Date.now() + 3600000 * 4);
      status = FollowUpStatus.PENDING;
    } else if (i % 4 === 2) {
      // Future
      dueAtDate = new Date(Date.now() + 86400000 * 5);
      status = FollowUpStatus.IN_PROGRESS;
    } else {
      // Completed
      dueAtDate = new Date(Date.now() - 86400000 * 3);
      status = FollowUpStatus.COMPLETED;
      completedAt = new Date(Date.now() - 86400000 * 2);
    }

    await prisma.followUp.create({
      data: {
        customerId: cust.id,
        title: `Follow-up on product consultation: ${cust.fullName}`,
        description: `Check document readiness and answer underwriting questions.`,
        dueAt: dueAtDate,
        status,
        completedAt,
      },
    });
  }
  console.log('✓ Seeded follow-up tasks.');

  // 11. Seed Recommendations (System rule outputs)
  const recommendationsCreated = [];
  for (let i = 0; i < 20; i++) {
    const cust = createdCustomers[i];
    const targetProd = createdProducts[(i + 1) % createdProducts.length];
    const rec = await prisma.recommendation.create({
      data: {
        customerId: cust.id,
        targetProductId: targetProd.id,
        recommendationType: 'RULE_ELIGIBILITY_MATCH',
        score: (0.75 + (i % 25) * 0.01),
        reason: `Matched active need [${targetProd.code}] with verified income profile > 25M VND and clean bureau record.`,
        status: i % 3 === 0 ? RecommendationStatus.ACCEPTED : RecommendationStatus.ACTIVE,
        generatedAt: new Date(Date.now() - (i + 1) * 86400000),
      },
    });
    recommendationsCreated.push(rec);
  }
  console.log(`✓ Seeded ${recommendationsCreated.length} rule-based recommendations.`);

  // 12. Seed Push Records (Operator physical referrals)
  const pushStatuses = [PushStatus.PENDING, PushStatus.IN_PROGRESS, PushStatus.SUCCESS, PushStatus.FAILED, PushStatus.CANCELLED];
  for (let i = 0; i < 15; i++) {
    const cust = createdCustomers[i];
    const prod = createdProducts[(i + 2) % createdProducts.length];
    const rec = recommendationsCreated[i % recommendationsCreated.length];
    const status = pushStatuses[i % pushStatuses.length];

    await prisma.pushRecord.create({
      data: {
        customerId: cust.id,
        targetProductId: prod.id,
        recommendationId: rec.id,
        status,
        pushedAt: new Date(Date.now() - (i + 2) * 86400000),
        resultAt: status === PushStatus.SUCCESS || status === PushStatus.FAILED ? new Date() : null,
        failureReason: status === PushStatus.FAILED ? 'Specialist contacted customer but customer declined meeting due to traveling.' : null,
        note: `Referred to Specialist Tran Minh at Wealth & Loan Desk. Referral ticket #${1000 + i}.`,
      },
    });
  }
  console.log('✓ Seeded push and referral records.');

  console.log('\n🎉 Database seed completed successfully with verified domain relations!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
