import {
  PrismaClient,
  UserRole,
  Locale,
  SourceType,
  PropertyType,
  PropertyStatus,
  ActivityType,
  ActivityDirection,
  TaskType,
  TaskStatus,
  ShowingStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  // ── Users ──────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@crm.local' },
    update: { fullName: 'Andrea Conti' },
    create: {
      email: 'admin@crm.local',
      passwordHash: await argon2.hash('admin12345'),
      fullName: 'Andrea Conti',
      role: UserRole.ADMIN,
    },
  });

  const realtor1 = await prisma.user.upsert({
    where: { email: 'realtor@crm.local' },
    update: { fullName: 'Иван Коваленко' },
    create: {
      email: 'realtor@crm.local',
      passwordHash: await argon2.hash('realtor12345'),
      fullName: 'Иван Коваленко',
      role: UserRole.REALTOR,
    },
  });

  const realtor2 = await prisma.user.upsert({
    where: { email: 'maria@crm.local' },
    update: { fullName: 'Мария Шевченко' },
    create: {
      email: 'maria@crm.local',
      passwordHash: await argon2.hash('realtor12345'),
      fullName: 'Мария Шевченко',
      role: UserRole.REALTOR,
    },
  });

  // ── Sources ────────────────────────────────────────────────────────────────
  const srcData = [
    { name: 'Facebook Lead Ads', type: SourceType.FB_LEAD_ADS },
    { name: 'Instagram',         type: SourceType.INSTAGRAM },
    { name: 'Telegram',          type: SourceType.TELEGRAM },
    { name: 'Сайт',              type: SourceType.WEBSITE },
    { name: 'Вручну',            type: SourceType.MANUAL },
    { name: 'Рекомендація',      type: SourceType.REFERRAL },
    { name: 'WhatsApp',          type: SourceType.WHATSAPP },
  ];
  const sources: Record<string, string> = {};
  for (const s of srcData) {
    const r = await prisma.source.upsert({ where: { name: s.name }, update: {}, create: s });
    sources[s.name] = r.id;
  }

  // ── Properties ─────────────────────────────────────────────────────────────
  async function upsertProp(address: string, data: Parameters<typeof prisma.property.create>[0]['data']) {
    const existing = await prisma.property.findFirst({ where: { address } });
    if (existing) return existing;
    return prisma.property.create({ data: data as any });
  }

  const prop1 = await upsertProp('просп. Оболонський, 7', {
    address: 'просп. Оболонський, 7', district: 'Оболонь', rooms: 3, area: 84, floor: 9,
    totalFloors: 16, price: 3800000, type: PropertyType.APARTMENT, status: PropertyStatus.AVAILABLE,
    description: 'Простора 3-кімнатна квартира з панорамним виглядом на Оболонську набережну. Євроремонт, нова сантехніка, вбудована кухня.',
  });
  const prop2 = await upsertProp('вул. Драгоманова, 4', {
    address: 'вул. Драгоманова, 4', district: 'Позняки', rooms: 2, area: 62, floor: 5,
    totalFloors: 12, price: 3200000, type: PropertyType.APARTMENT, status: PropertyStatus.IN_SHOWING,
    description: '2-кімнатна на Позняках, поряд із метро. Гарний стан, можлива іпотека.',
  });
  const prop3 = await upsertProp('вул. Велика Васильківська, 55', {
    address: 'вул. Велика Васильківська, 55', district: 'Шевченківський', rooms: 1, area: 38, floor: 3,
    totalFloors: 9, price: 2200000, type: PropertyType.APARTMENT, status: PropertyStatus.AVAILABLE,
    description: 'Студія в центрі міста. Ідеально для інвестиції або молодої пари.',
  });
  const prop4 = await upsertProp('вул. Конча-Заспа, садиба 12', {
    address: 'вул. Конча-Заспа, садиба 12', district: 'Конча-Заспа', rooms: 6, area: 320, floor: 1,
    totalFloors: 2, price: 18500000, type: PropertyType.HOUSE, status: PropertyStatus.AVAILABLE,
    description: 'Елітний котедж у Кончі-Заспі. Закрите охоронюване містечко, басейн, власна ділянка 15 соток.',
  });
  const prop5 = await upsertProp('вул. Липська, 3', {
    address: 'вул. Липська, 3', district: 'Печерськ', rooms: 4, area: 148, floor: 12,
    totalFloors: 20, price: 12000000, type: PropertyType.APARTMENT, status: PropertyStatus.RESERVED,
    description: 'Преміум апартаменти на Печерську. Консьєрж-сервіс, підземний паркінг, вид на Дніпро.',
  });
  const prop6 = await upsertProp('просп. Перемоги, 42', {
    address: 'просп. Перемоги, 42', district: 'Шевченківський', rooms: 3, area: 78, floor: 7,
    totalFloors: 14, price: 4500000, type: PropertyType.APARTMENT, status: PropertyStatus.AVAILABLE,
    description: '3-кімнатна на Перемоги, свіжий косметичний ремонт, вікна у двір.',
  });

  // RENT inventory
  const propR1 = await upsertProp('вул. Антоновича, 47 (оренда)', {
    address: 'вул. Антоновича, 47 (оренда)', district: 'Шевченківський', rooms: 2, area: 58, floor: 4,
    totalFloors: 9, price: 24000, currency: 'UAH', type: PropertyType.APARTMENT, status: PropertyStatus.AVAILABLE,
    dealIntent: 'RENT', description: 'Затишна 2-кімнатна квартира з косметичним ремонтом. Здається з меблями та технікою. Поряд метро.',
  });
  const propR2 = await upsertProp('вул. Хрещатик, 15 (оренда)', {
    address: 'вул. Хрещатик, 15 (оренда)', district: 'Шевченківський', rooms: 1, area: 42, floor: 8,
    totalFloors: 16, price: 18500, currency: 'UAH', type: PropertyType.APARTMENT, status: PropertyStatus.AVAILABLE,
    dealIntent: 'RENT', description: 'Сучасна 1-кімнатна в самому серці міста. Дизайнерський ремонт, кондиціонер, інтернет.',
  });
  void propR1; void propR2;

  // ── Clients (20) ───────────────────────────────────────────────────────────
  const clientData = [
    { n: 'Андрій Мельник',       p: '+380671234001', e: 'melnyk.a@gmail.com',    img: 3  },
    { n: 'Олена Бондаренко',     p: '+380672234002', e: 'bondarenko.o@ukr.net',  img: 6  },
    { n: 'Василь Ткаченко',      p: '+380673234003', e: 'tkachenko.v@gmail.com', img: 8  },
    { n: 'Ірина Коваль',         p: '+380674234004', e: 'koval.i@meta.ua',       img: 11 },
    { n: 'Дмитро Шевченко',      p: '+380675234005', e: 'shevchenko.d@gmail.com',img: 13 },
    { n: 'Наталія Бойко',        p: '+380676234006', e: 'boyko.n@ukr.net',       img: 15 },
    { n: 'Сергій Поліщук',       p: '+380677234007', e: 'polishchuk.s@gmail.com',img: 18 },
    { n: 'Тетяна Мороз',         p: '+380678234008', e: 'moroz.t@gmail.com',     img: 22 },
    { n: 'Андрій Лисенко',       p: '+380679234009', e: 'lysenko.a@meta.ua',     img: 25 },
    { n: 'Юлія Кравченко',       p: '+380680234010', e: 'kravchenko.y@gmail.com',img: 29 },
    { n: 'Павло Гончаренко',     p: '+380681234011', e: 'honcharenko.p@ukr.net', img: 32 },
    { n: 'Людмила Савченко',     p: '+380682234012', e: 'savchenko.l@gmail.com', img: 39 },
    { n: 'Микола Захаренко',     p: '+380683234013', e: 'zakharenko.m@gmail.com',img: 41 },
    { n: 'Вікторія Романенко',   p: '+380684234014', e: 'romanenko.v@ukr.net',   img: 44 },
    { n: 'Ігор Панченко',        p: '+380685234015', e: 'panchenko.i@gmail.com', img: 47 },
    { n: 'Галина Сидоренко',     p: '+380686234016', e: 'sydorenko.h@meta.ua',   img: 49 },
    { n: 'Руслан Іваненко',      p: '+380687234017', e: 'ivanenko.r@gmail.com',  img: 56 },
    { n: 'Оксана Петренко',      p: '+380688234018', e: 'petrenko.o@ukr.net',    img: 58 },
    { n: 'Богдан Карпенко',      p: '+380689234019', e: 'karpenko.b@gmail.com',  img: 60 },
    { n: 'Алла Тимошенко',       p: '+380690234020', e: 'tymoshenko.a@gmail.com',img: 64 },
  ];

  const clientIds: Record<string, string> = {};
  for (const c of clientData) {
    const r = await prisma.client.upsert({
      where: { primaryPhone: c.p },
      update: { avatarUrl: `https://i.pravatar.cc/150?img=${c.img}` },
      create: {
        fullName: c.n, primaryPhone: c.p, email: c.e,
        avatarUrl: `https://i.pravatar.cc/150?img=${c.img}`,
      },
    });
    clientIds[c.n] = r.id;
  }

  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
  const r1 = realtor1.id, r2 = realtor2.id;

  // ── Leads (20) ─────────────────────────────────────────────────────────────
  async function mkLead(
    clientName: string, stage: string, agentId: string, srcKey: string,
    propId?: string, lostReason?: string,
  ) {
    const existing = await prisma.lead.findFirst({ where: { clientId: clientIds[clientName] } });
    if (existing) return existing;
    return prisma.lead.create({
      data: {
        clientId: clientIds[clientName],
        stage: stage as any,
        assignedUserId: agentId,
        sourceId: sources[srcKey] ?? undefined,
        interestPropertyId: propId ?? undefined,
        lostReason: lostReason ?? null,
      },
    });
  }

  const lead1  = await mkLead('Андрій Мельник',      'WON',         r1, 'Facebook Lead Ads', prop1.id);
  const lead2  = await mkLead('Олена Бондаренко',    'NEGOTIATION', r1, 'Instagram',          prop2.id);
  const lead3  = await mkLead('Василь Ткаченко',     'SHOWING',     r2, 'Telegram',            prop3.id);
  const lead4  = await mkLead('Ірина Коваль',        'QUALIFIED',   r1, 'Рекомендація',        prop1.id);
  const lead5  = await mkLead('Дмитро Шевченко',     'LOST',        r2, 'Сайт',               prop2.id, 'висока ціна');
  const lead6  = await mkLead('Наталія Бойко',       'WON',         r2, 'Facebook Lead Ads',   prop4.id);
  const lead7  = await mkLead('Сергій Поліщук',      'SHOWING',     r1, 'WhatsApp',            prop6.id);
  const lead8  = await mkLead('Тетяна Мороз',        'CONTACTED',   r2, 'Вручну',              prop3.id);
  const lead9  = await mkLead('Андрій Лисенко',      'NEGOTIATION', r1, 'Рекомендація',        prop5.id);
  const lead10 = await mkLead('Юлія Кравченко',      'QUALIFIED',   r2, 'Instagram',           prop6.id);
  const lead11 = await mkLead('Павло Гончаренко',    'LOST',        r1, 'Сайт',               prop1.id, 'переїхав');
  const lead12 = await mkLead('Людмила Савченко',    'CONTACTED',   r2, 'Facebook Lead Ads',  prop2.id);
  const lead13 = await mkLead('Микола Захаренко',    'NEW',         r1, 'Telegram');
  const lead14 = await mkLead('Вікторія Романенко',  'SHOWING',     r2, 'WhatsApp',            prop4.id);
  const lead15 = await mkLead('Ігор Панченко',       'NEGOTIATION', r1, 'Рекомендація',        prop5.id);
  const lead16 = await mkLead('Галина Сидоренко',    'CONTACTED',   r2, 'Вручну',              prop3.id);
  const lead17 = await mkLead('Руслан Іваненко',     'QUALIFIED',   r1, 'Instagram',           prop6.id);
  const lead18 = await mkLead('Оксана Петренко',     'LOST',        r2, 'Сайт',               prop2.id, 'не відповідає');
  const lead19 = await mkLead('Богдан Карпенко',     'SHOWING',     r1, 'Facebook Lead Ads',  prop1.id);
  const lead20 = await mkLead('Алла Тимошенко',      'NEW',         r2, 'WhatsApp');

  // ── Activity helper ────────────────────────────────────────────────────────
  // NOTE: Activity.clientId is REQUIRED in schema. Activity.userId = agent/user.
  // Activity.content (not body). No durationSec field — put in metadata.
  async function act(
    lead: { id: string; clientId: string },
    type: ActivityType,
    direction: ActivityDirection,
    userId: string,
    content: string,
    daysBack: number,
    meta?: Record<string, unknown>,
  ) {
    return prisma.activity.create({
      data: {
        clientId: lead.clientId,
        leadId: lead.id,
        userId,
        type,
        direction,
        content,
        metadata: meta ?? null,
        createdAt: daysAgo(daysBack),
      },
    });
  }

  // ── Activities per lead ────────────────────────────────────────────────────

  // lead1 — Андрій Мельник (WON)
  await act(lead1,'CALL','IN',r1,'Клієнт зателефонував, зацікавлений Оболонню. Хоче 3 кімнати, бюджет до 4М.',30,{durationSec:240});
  await act(lead1,'WHATSAPP','OUT',r1,'Надіслав фото та планування квартири на Оболонському 7.',29);
  await act(lead1,'STAGE_CHANGE','INTERNAL',r1,'NEW → CONTACTED',29);
  await act(lead1,'CALL','OUT',r1,"Домовились про показ на п'ятницю 14:00.",27,{durationSec:180});
  await act(lead1,'STAGE_CHANGE','INTERNAL',r1,'CONTACTED → QUALIFIED',27);
  await act(lead1,'SHOWING','INTERNAL',r1,'Показ відбувся. Клієнту все сподобалось.',24);
  await act(lead1,'STAGE_CHANGE','INTERNAL',r1,'QUALIFIED → SHOWING',24);
  await act(lead1,'CALL','IN',r1,'Андрій погоджується на ціну, просить договір.',22,{durationSec:310});
  await act(lead1,'STAGE_CHANGE','INTERNAL',r1,'SHOWING → NEGOTIATION',22);
  await act(lead1,'EMAIL','OUT',r1,'Надіслано попередній договір купівлі-продажу.',21);
  await act(lead1,'WHATSAPP','IN',r1,'Клієнт підтверджує — готовий до підписання.',20);
  await act(lead1,'NOTE','INTERNAL',r1,'Підписали договір. Угода закрита. Комісія 3% отримана.',18);
  await act(lead1,'STAGE_CHANGE','INTERNAL',r1,'NEGOTIATION → WON',18);

  // lead2 — Олена Бондаренко (NEGOTIATION)
  await act(lead2,'CALL','IN',r1,'Олена знайшла оголошення в Instagram. Бюджет 3–3.5М.',21,{durationSec:195});
  await act(lead2,'INSTAGRAM','OUT',r1,"Надіслала в директ посилання на об'єкт і детальні фото.",20);
  await act(lead2,'STAGE_CHANGE','INTERNAL',r1,'NEW → CONTACTED',20);
  await act(lead2,'CALL','OUT',r1,'Уточнили побажання: поверх не нижче 3, є паркінг.',18,{durationSec:150});
  await act(lead2,'STAGE_CHANGE','INTERNAL',r1,'CONTACTED → QUALIFIED',18);
  await act(lead2,'SHOWING','INTERNAL',r1,'Показ на Драгоманова 4. Сподобалась кухня, є питання по вікнах.',15);
  await act(lead2,'STAGE_CHANGE','INTERNAL',r1,'QUALIFIED → SHOWING',15);
  await act(lead2,'WHATSAPP','IN',r1,'Олена питає, чи можна торг 100к. Передала власнику.',12);
  await act(lead2,'CALL','IN',r1,'Власник погоджується на 3.1М. Підтвердила клієнту.',10,{durationSec:270});
  await act(lead2,'STAGE_CHANGE','INTERNAL',r1,'SHOWING → NEGOTIATION',10);
  await act(lead2,'NOTE','INTERNAL',r1,'Готуємо документи. Клієнт взяв 3 дні на перевірку юристом.',8);

  // lead3 — Василь Ткаченко (SHOWING)
  await act(lead3,'TELEGRAM','IN',r2,'Написав у Telegram-бот. Шукає студію в центрі до 2.5М.',16);
  await act(lead3,'CALL','OUT',r2,'Зателефонувала, розповіла про Васильківську 55. Погодився на показ.',15,{durationSec:200});
  await act(lead3,'STAGE_CHANGE','INTERNAL',r2,'NEW → CONTACTED',15);
  await act(lead3,'STAGE_CHANGE','INTERNAL',r2,'CONTACTED → QUALIFIED',14);
  await act(lead3,'SHOWING','INTERNAL',r2,'Показ студії. Подобається розташування, хвилює кухня-ніша.',11);
  await act(lead3,'STAGE_CHANGE','INTERNAL',r2,'QUALIFIED → SHOWING',11);
  await act(lead3,'WHATSAPP','OUT',r2,'Надіслала відео ще раз і план ремонту для кухні-ніші.',9);

  // lead4 — Ірина Коваль (QUALIFIED)
  await act(lead4,'CALL','IN',r1,'Рекомендував знайомий. Хоче 3-кімнатну на Оболоні, є іпотека.',14,{durationSec:220});
  await act(lead4,'EMAIL','OUT',r1,'Надіслав перелік документів для іпотеки і опис квартири.',13);
  await act(lead4,'STAGE_CHANGE','INTERNAL',r1,'NEW → CONTACTED',13);
  await act(lead4,'CALL','OUT',r1,'Кваліфікував: є передоплата 500к, решта іпотека. Банк підтвердив.',11,{durationSec:185});
  await act(lead4,'STAGE_CHANGE','INTERNAL',r1,'CONTACTED → QUALIFIED',11);
  await act(lead4,'NOTE','INTERNAL',r1,'Зарезервував квартиру для Ірини на 7 днів.',10);

  // lead5 — Дмитро Шевченко (LOST)
  await act(lead5,'CALL','IN',r2,'Зацікавлений Позняками. Бюджет 2.8М максимум.',25,{durationSec:160});
  await act(lead5,'STAGE_CHANGE','INTERNAL',r2,'NEW → CONTACTED',25);
  await act(lead5,'SHOWING','INTERNAL',r2,'Показ на Драгоманова 4. Ціна 3.2М не підходить.',22);
  await act(lead5,'CALL','OUT',r2,'Намагалась переконати, що ціна ринкова. Клієнт відмовився.',20,{durationSec:120});
  await act(lead5,'STAGE_CHANGE','INTERNAL',r2,'SHOWING → LOST',20);

  // lead6 — Наталія Бойко (WON)
  await act(lead6,'CALL','IN',r2,'Реклама Facebook. Шукає котедж Конча-Заспа, бюджет до 20М.',45,{durationSec:420});
  await act(lead6,'STAGE_CHANGE','INTERNAL',r2,'NEW → CONTACTED',45);
  await act(lead6,'CALL','OUT',r2,'Уточнила вимоги: басейн, ділянка, безпека.',43,{durationSec:300});
  await act(lead6,'STAGE_CHANGE','INTERNAL',r2,'CONTACTED → QUALIFIED',43);
  await act(lead6,'SHOWING','INTERNAL',r2,"Виїзд на об'єкт. Клієнт захоплений.",40);
  await act(lead6,'STAGE_CHANGE','INTERNAL',r2,'QUALIFIED → SHOWING',40);
  await act(lead6,'WHATSAPP','IN',r2,'Наталія підтверджує купівлю. Просить рахунок.',38);
  await act(lead6,'STAGE_CHANGE','INTERNAL',r2,'SHOWING → NEGOTIATION',38);
  await act(lead6,'EMAIL','OUT',r2,'Надіслано фінальний договір і реквізити для оплати.',36);
  await act(lead6,'NOTE','INTERNAL',r2,'Угода закрита, ключі передані.',35);
  await act(lead6,'STAGE_CHANGE','INTERNAL',r2,'NEGOTIATION → WON',35);

  // lead7 — Сергій Поліщук (SHOWING)
  await act(lead7,'WHATSAPP','IN',r1,'Написав у WhatsApp: шукає 3-кімнатну на Шевченківському.',8);
  await act(lead7,'CALL','OUT',r1,'Провели переговори. Показав варіант просп. Перемоги 42.',7,{durationSec:240});
  await act(lead7,'STAGE_CHANGE','INTERNAL',r1,'NEW → CONTACTED',7);
  await act(lead7,'STAGE_CHANGE','INTERNAL',r1,'CONTACTED → QUALIFIED',6);
  await act(lead7,'SHOWING','INTERNAL',r1,'Показ відбувся. Хоче порадитись з дружиною.',4);
  await act(lead7,'STAGE_CHANGE','INTERNAL',r1,'QUALIFIED → SHOWING',4);

  // lead8 — Тетяна Мороз (CONTACTED)
  await act(lead8,'CALL','IN',r2,'Дзвінок: шукає студію або 1-кімнатну, центр, до 2.5М.',10,{durationSec:170});
  await act(lead8,'WHATSAPP','OUT',r2,'Надіслала інформацію про Васильківську 55.',9);
  await act(lead8,'STAGE_CHANGE','INTERNAL',r2,'NEW → CONTACTED',9);

  // lead9 — Андрій Лисенко (NEGOTIATION)
  await act(lead9,'CALL','IN',r1,'Рекомендація від клієнта Мельника. Шукає преміум на Печерську.',35,{durationSec:350});
  await act(lead9,'STAGE_CHANGE','INTERNAL',r1,'NEW → CONTACTED',35);
  await act(lead9,'EMAIL','OUT',r1,"Презентація об'єкта Липська 3 з рендерами та планами.",34);
  await act(lead9,'STAGE_CHANGE','INTERNAL',r1,'CONTACTED → QUALIFIED',33);
  await act(lead9,'SHOWING','INTERNAL',r1,'Показ Липська 3 з власником. Враження позитивні.',30);
  await act(lead9,'STAGE_CHANGE','INTERNAL',r1,'QUALIFIED → SHOWING',30);
  await act(lead9,'CALL','IN',r1,'Андрій пропонує 11.5М. Передав власнику.',27,{durationSec:260});
  await act(lead9,'STAGE_CHANGE','INTERNAL',r1,'SHOWING → NEGOTIATION',27);
  await act(lead9,'NOTE','INTERNAL',r1,'Власник готовий на 11.8М. Очікуємо відповіді клієнта.',25);

  // lead10 — Юлія Кравченко (QUALIFIED)
  await act(lead10,'INSTAGRAM','IN',r2,'Написала в Instagram: цікавить Шевченківський, 2-3 кімн.',7);
  await act(lead10,'CALL','OUT',r2,'Зателефонувала, кваліфікувала. Бюджет 4.5–5М.',6,{durationSec:210});
  await act(lead10,'STAGE_CHANGE','INTERNAL',r2,'NEW → CONTACTED',6);
  await act(lead10,'WHATSAPP','OUT',r2,'Надіслала варіант просп. Перемоги 42.',5);
  await act(lead10,'STAGE_CHANGE','INTERNAL',r2,'CONTACTED → QUALIFIED',5);

  // lead11 — Павло Гончаренко (LOST)
  await act(lead11,'CALL','IN',r1,'Сайт. Питав про Оболонський 7. Бюджет 4М.',40,{durationSec:140});
  await act(lead11,'STAGE_CHANGE','INTERNAL',r1,'NEW → CONTACTED',40);
  await act(lead11,'NOTE','INTERNAL',r1,'Клієнт повідомив — переїжджає до Польщі.',38);
  await act(lead11,'STAGE_CHANGE','INTERNAL',r1,'CONTACTED → LOST',38);

  // lead12 — Людмила Савченко (CONTACTED)
  await act(lead12,'CALL','IN',r2,'Facebook. Шукає 2-кімнатну Позняки.',6,{durationSec:155});
  await act(lead12,'STAGE_CHANGE','INTERNAL',r2,'NEW → CONTACTED',6);
  await act(lead12,'EMAIL','OUT',r2,'Надіслала підбірку: Драгоманова 4 та ще 2 варіанти.',5);

  // lead13 — Микола Захаренко (NEW)
  await act(lead13,'TELEGRAM','IN',r1,'Написав у Telegram. Шукає квартиру, уточнює умови.',2);

  // lead14 — Вікторія Романенко (SHOWING)
  await act(lead14,'WHATSAPP','IN',r2,'Написала в WhatsApp про котедж Конча-Заспа.',12);
  await act(lead14,'CALL','OUT',r2,"Уточнила деталі, розповіла про об'єкт.",11,{durationSec:190});
  await act(lead14,'STAGE_CHANGE','INTERNAL',r2,'NEW → CONTACTED',11);
  await act(lead14,'STAGE_CHANGE','INTERNAL',r2,'CONTACTED → QUALIFIED',10);
  await act(lead14,'SHOWING','INTERNAL',r2,'Виїзний показ котеджу. Вікторія задоволена ділянкою.',8);
  await act(lead14,'STAGE_CHANGE','INTERNAL',r2,'QUALIFIED → SHOWING',8);

  // lead15 — Ігор Панченко (NEGOTIATION)
  await act(lead15,'CALL','IN',r1,'Рекомендація. Преміум Печерськ, бюджет 12–13М.',20,{durationSec:300});
  await act(lead15,'STAGE_CHANGE','INTERNAL',r1,'NEW → CONTACTED',20);
  await act(lead15,'EMAIL','OUT',r1,'Надіслав брошуру Липська 3.',19);
  await act(lead15,'STAGE_CHANGE','INTERNAL',r1,'CONTACTED → QUALIFIED',18);
  await act(lead15,'SHOWING','INTERNAL',r1,"Показ з власником. Клієнт готовий іти на угоду.",15);
  await act(lead15,'STAGE_CHANGE','INTERNAL',r1,'QUALIFIED → SHOWING',15);
  await act(lead15,'CALL','IN',r1,'Ігор пропонує 11.7М. Направив на узгодження.',12,{durationSec:240});
  await act(lead15,'STAGE_CHANGE','INTERNAL',r1,'SHOWING → NEGOTIATION',12);

  // lead16 — Галина Сидоренко (CONTACTED)
  await act(lead16,'CALL','IN',r2,'Дзвінок з сайту. Студія або 1-кімн, Шевченківський.',5,{durationSec:130});
  await act(lead16,'WHATSAPP','OUT',r2,'Надіслала Васильківська 55.',4);
  await act(lead16,'STAGE_CHANGE','INTERNAL',r2,'NEW → CONTACTED',4);

  // lead17 — Руслан Іваненко (QUALIFIED)
  await act(lead17,'INSTAGRAM','IN',r1,'Instagram DM. Шукає 2-3 кімн, Шевченківський, до 5М.',9);
  await act(lead17,'CALL','OUT',r1,'Зателефонував, кваліфікував.',8,{durationSec:175});
  await act(lead17,'STAGE_CHANGE','INTERNAL',r1,'NEW → CONTACTED',8);
  await act(lead17,'STAGE_CHANGE','INTERNAL',r1,'CONTACTED → QUALIFIED',7);
  await act(lead17,'NOTE','INTERNAL',r1,'Підходить Перемоги 42. Чекаємо на підтвердження дати показу.',6);

  // lead18 — Оксана Петренко (LOST)
  await act(lead18,'CALL','IN',r2,'Сайт. Позняки, 2-кімн.',30,{durationSec:120});
  await act(lead18,'STAGE_CHANGE','INTERNAL',r2,'NEW → CONTACTED',30);
  await act(lead18,'WHATSAPP','OUT',r2,'Надіслала варіанти. Клієнт не читає.',28);
  await act(lead18,'CALL','OUT',r2,'Спроба 2 — не відповідає.',26,{durationSec:0});
  await act(lead18,'CALL','OUT',r2,'Спроба 3 — не відповідає.',24,{durationSec:0});
  await act(lead18,'STAGE_CHANGE','INTERNAL',r2,'CONTACTED → LOST',23);

  // lead19 — Богдан Карпенко (SHOWING)
  await act(lead19,'CALL','IN',r1,'Facebook. Оболонь 3-кімн.',6,{durationSec:200});
  await act(lead19,'STAGE_CHANGE','INTERNAL',r1,'NEW → CONTACTED',6);
  await act(lead19,'STAGE_CHANGE','INTERNAL',r1,'CONTACTED → QUALIFIED',5);
  await act(lead19,'SHOWING','INTERNAL',r1,"Перший показ Оболонський 7. Сподобалось, хоче ще раз зі сім'єю.",3);
  await act(lead19,'STAGE_CHANGE','INTERNAL',r1,'QUALIFIED → SHOWING',3);

  // lead20 — Алла Тимошенко (NEW)
  await act(lead20,'WHATSAPP','IN',r2,'WhatsApp: питає про наявні квартири до 3М.',1);

  // ── Showings ───────────────────────────────────────────────────────────────
  const showingRows = [
    { lead: lead1,  propId: prop1.id, agentId: r1, when: 24, st: ShowingStatus.COMPLETED, fb: 'Клієнту дуже сподобалось. Вид, планування — все ідеально.' },
    { lead: lead2,  propId: prop2.id, agentId: r1, when: 15, st: ShowingStatus.COMPLETED, fb: 'Питання по вікнах. Загалом позитивне враження.' },
    { lead: lead3,  propId: prop3.id, agentId: r2, when: 11, st: ShowingStatus.COMPLETED, fb: 'Студія сподобалась. Хвилює кухня-ніша.' },
    { lead: lead5,  propId: prop2.id, agentId: r2, when: 22, st: ShowingStatus.COMPLETED, fb: 'Ціна не підходить. Клієнт відмовився.' },
    { lead: lead6,  propId: prop4.id, agentId: r2, when: 40, st: ShowingStatus.COMPLETED, fb: 'Котедж надзвичайно сподобався. Покупець закрив угоду.' },
    { lead: lead7,  propId: prop6.id, agentId: r1, when: 4,  st: ShowingStatus.COMPLETED, fb: 'Вдоволений. Хоче порадитись з дружиною.' },
    { lead: lead9,  propId: prop5.id, agentId: r1, when: 30, st: ShowingStatus.COMPLETED, fb: 'Позитивні враження, почали переговори.' },
    { lead: lead14, propId: prop4.id, agentId: r2, when: 8,  st: ShowingStatus.COMPLETED, fb: 'Вікторія задоволена ділянкою і басейном.' },
    { lead: lead15, propId: prop5.id, agentId: r1, when: 15, st: ShowingStatus.COMPLETED, fb: 'Клієнт готовий. Переходимо до угоди.' },
    { lead: lead19, propId: prop1.id, agentId: r1, when: 3,  st: ShowingStatus.COMPLETED, fb: 'Перший показ пройшов добре. Повторний зі сімейю.' },
    { lead: lead3,  propId: prop3.id, agentId: r2, when: -3, st: ShowingStatus.SCHEDULED,  fb: null },
  ];

  for (const s of showingRows) {
    const existing = await prisma.showing.findFirst({
      where: { clientId: s.lead.clientId, propertyId: s.propId },
    });
    if (!existing) {
      await prisma.showing.create({
        data: {
          propertyId: s.propId,
          clientId: s.lead.clientId,
          agentId: s.agentId,
          scheduledAt: daysAgo(s.when),
          status: s.st,
          feedback: s.fb,
        },
      });
    }
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────
  // Task uses: userId (agent), dueAt (DateTime), leadId (optional)
  const taskRows = [
    { lead: lead2,  uid: r1, type: TaskType.CALL,     title: 'Зателефонувати Олені щодо рішення по торгу',        days:  1, st: TaskStatus.PENDING },
    { lead: lead3,  uid: r2, type: TaskType.SHOWING,  title: 'Повторний показ Васильківська 55 — з чоловіком',    days:  3, st: TaskStatus.PENDING },
    { lead: lead4,  uid: r1, type: TaskType.FOLLOWUP, title: 'Перевірити статус іпотечного рішення в банку',      days:  2, st: TaskStatus.PENDING },
    { lead: lead7,  uid: r1, type: TaskType.CALL,     title: 'Передзвонити Сергію після обговорення з дружиною',  days:  2, st: TaskStatus.PENDING },
    { lead: lead8,  uid: r2, type: TaskType.SHOWING,  title: 'Організувати показ Васильківська 55 для Тетяни',    days:  4, st: TaskStatus.PENDING },
    { lead: lead9,  uid: r1, type: TaskType.CALL,     title: 'Відповідь від Андрія щодо 11.8М',                   days:  1, st: TaskStatus.PENDING },
    { lead: lead10, uid: r2, type: TaskType.SHOWING,  title: 'Показ для Юлії: Перемоги 42',                       days:  5, st: TaskStatus.PENDING },
    { lead: lead12, uid: r2, type: TaskType.CALL,     title: 'Уточнити, чи переглянула Людмила варіанти',         days:  1, st: TaskStatus.PENDING },
    { lead: lead13, uid: r1, type: TaskType.CALL,     title: 'Перший дзвінок Миколі Захаренку',                   days:  0, st: TaskStatus.PENDING },
    { lead: lead14, uid: r2, type: TaskType.FOLLOWUP, title: 'Followup після показу котеджу — рішення Вікторії',  days:  2, st: TaskStatus.PENDING },
    { lead: lead15, uid: r1, type: TaskType.CALL,     title: 'Дзвінок власнику щодо пропозиції 11.7М',            days:  1, st: TaskStatus.PENDING },
    { lead: lead16, uid: r2, type: TaskType.SHOWING,  title: 'Запропонувати Галині показ Васильківська 55',       days:  3, st: TaskStatus.PENDING },
    { lead: lead17, uid: r1, type: TaskType.SHOWING,  title: 'Показ Перемоги 42 для Руслана',                     days:  4, st: TaskStatus.PENDING },
    { lead: lead1,  uid: r1, type: TaskType.FOLLOWUP, title: 'Відгук Андрія після заїзду',                        days: -5, st: TaskStatus.DONE    },
    { lead: lead6,  uid: r2, type: TaskType.FOLLOWUP, title: 'Відгук Наталії після заїзду в котедж',              days:-32, st: TaskStatus.DONE    },
  ];

  for (const tk of taskRows) {
    await prisma.task.create({
      data: {
        userId: tk.uid,
        clientId: tk.lead.clientId,
        leadId: tk.lead.id,
        type: tk.type,
        title: tk.title,
        dueAt: new Date(Date.now() + tk.days * 86_400_000),
        status: tk.st,
        completedAt: tk.st === TaskStatus.DONE ? new Date() : null,
      },
    });
  }

  // ── Contract Templates ─────────────────────────────────────────────────────
  const tplRows = [
    {
      name: 'Вітальний лист клієнту',
      language: Locale.uk,
      content: 'Доброго дня, {{clientName}}!\n\nДякуємо за звернення до нашого агентства нерухомості. Ваш менеджер {{agentName}} зв\'яжеться з вами протягом 30 хвилин.\n\nЗ повагою,\nКоманда CRM',
      isActive: true,
    },
    {
      name: 'Нагадування про показ',
      language: Locale.uk,
      content: 'Доброго дня, {{clientName}}! Нагадуємо, що завтра о {{showingTime}} відбудеться показ квартири за адресою {{address}}. Якщо виникли питання — пишіть або телефонуйте.',
      isActive: true,
    },
    {
      name: 'Фідбек після показу',
      language: Locale.uk,
      content: 'Добрий день, {{clientName}}! Як враження від вчорашнього показу? Чи маєте додаткові питання? Будемо раді допомогти з вибором!',
      isActive: true,
    },
  ];

  for (const tpl of tplRows) {
    await prisma.contractTemplate.upsert({
      where: { name: tpl.name },
      update: {},
      create: tpl,
    });
  }

  // ── Automation Rules ───────────────────────────────────────────────────────
  const autoRows = [
    {
      name: 'Сповіщення SLA: без активності 48 год',
      condition: { type: 'INACTIVITY', hours: 48 },
      action: { type: 'NOTIFY_MANAGER' },
      priority: 10,
      isActive: true,
    },
    {
      name: 'Архівувати застарілий лід (7 днів без відповіді)',
      condition: { type: 'INACTIVITY', hours: 168, stage: 'CONTACTED' },
      action: { type: 'MOVE_TO_LOST', reason: 'не відповідає' },
      priority: 5,
      isActive: false,
    },
    {
      name: 'Нагадування про показ за 1 годину',
      condition: { type: 'SHOWING_REMINDER', minutesBefore: 60 },
      action: { type: 'SEND_WHATSAPP', templateName: 'Нагадування про показ' },
      priority: 20,
      isActive: true,
    },
    {
      name: 'Followup після показу — через 24 години',
      condition: { type: 'AFTER_SHOWING', hours: 24 },
      action: { type: 'CREATE_TASK', taskType: 'FOLLOWUP', title: 'Followup після показу' },
      priority: 15,
      isActive: true,
    },
  ];

  for (const ar of autoRows) {
    const ex = await prisma.automationRule.findFirst({ where: { name: ar.name } });
    if (!ex) await prisma.automationRule.create({ data: ar });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEMO MODE EXPANSION — makes the CRM look like a real working system on
  // first open. Adds European-market context (IT/FR/DE clients), realistic
  // funnel distribution (~40% NEW / 25% CONTACTED / 15% QUALIFIED / 10%
  // SHOWING / 7% NEGOTIATION / 3% WON), real Deal records, notifications,
  // overdue tasks, and exercises every feature flag (archive, blacklist,
  // isAvailable, marketingConsent, interestNote, interestPhotoUrl).
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Extra users (so workload dashboard has more than 2 agents) ─────────────
  const realtor3 = await prisma.user.upsert({
    where: { email: 'sofia@crm.local' },
    update: {},
    create: {
      email: 'sofia@crm.local',
      passwordHash: await argon2.hash('realtor12345'),
      fullName: 'Sofia Ricci',
      role: UserRole.REALTOR,
      locale: Locale.uk,
    },
  });
  // Demo: this realtor is on vacation — round-robin should skip them
  const realtor4 = await prisma.user.upsert({
    where: { email: 'pierre@crm.local' },
    update: {},
    create: {
      email: 'pierre@crm.local',
      passwordHash: await argon2.hash('realtor12345'),
      fullName: 'Pierre Lambert',
      role: UserRole.REALTOR,
      isAvailable: false,
    },
  });
  const manager = await prisma.user.upsert({
    where: { email: 'manager@crm.local' },
    update: {},
    create: {
      email: 'manager@crm.local',
      passwordHash: await argon2.hash('manager12345'),
      fullName: 'Anna Bianchi',
      role: UserRole.MANAGER,
    },
  });
  const r3 = realtor3.id, r4 = realtor4.id;
  void manager;

  // ── European inventory (BUY + RENT, varied price ranges + EUR currency) ────
  const moreProps = [
    // RENT — high demand category, more of these for funnel realism
    { a: 'Via del Corso, 122',     d: 'Centro · Roma',     r: 2, ar: 75,  fl: 4,  tf: 6,  p: 2200,    c: 'EUR', t: PropertyType.APARTMENT, st: PropertyStatus.AVAILABLE, di: 'RENT' as const, ds: 'Elegant 2-bed in central Rome, fully furnished, marble bathroom.' },
    { a: 'Rue Cler, 7',            d: '7th · Paris',       r: 1, ar: 42,  fl: 3,  tf: 5,  p: 1850,    c: 'EUR', t: PropertyType.APARTMENT, st: PropertyStatus.AVAILABLE, di: 'RENT' as const, ds: 'Charming studio near Eiffel Tower, recently renovated.' },
    { a: 'Calle Mayor, 45',        d: 'Sol · Madrid',      r: 3, ar: 95,  fl: 5,  tf: 7,  p: 1700,    c: 'EUR', t: PropertyType.APARTMENT, st: PropertyStatus.AVAILABLE, di: 'RENT' as const, ds: 'Spacious 3-bed in Sol district, walking distance to everything.' },
    { a: 'Via Brera, 18',          d: 'Brera · Milano',    r: 1, ar: 55,  fl: 2,  tf: 5,  p: 1950,    c: 'EUR', t: PropertyType.APARTMENT, st: PropertyStatus.AVAILABLE, di: 'RENT' as const, ds: 'Designer loft in fashion district, exposed brick, high ceilings.' },
    { a: 'Avenue Montaigne, 32',   d: '8th · Paris',       r: 4, ar: 140, fl: 6,  tf: 8,  p: 5500,    c: 'EUR', t: PropertyType.APARTMENT, st: PropertyStatus.IN_SHOWING,di: 'RENT' as const, ds: 'Haussmann classic, balcony, concierge, premium location.' },
    // BUY — premium European listings
    { a: 'Lungarno Vespucci, 24',  d: 'Florence',          r: 4, ar: 165, fl: 2,  tf: 4,  p: 1250000, c: 'EUR', t: PropertyType.APARTMENT, st: PropertyStatus.AVAILABLE, di: 'BUY' as const,  ds: 'Renaissance-era palazzo apartment overlooking the Arno river.' },
    { a: 'Rue du Faubourg-Saint-Honoré, 88', d: '8th · Paris', r: 5, ar: 210, fl: 4,  tf: 7,  p: 3450000, c: 'EUR', t: PropertyType.APARTMENT, st: PropertyStatus.AVAILABLE, di: 'BUY' as const,  ds: 'Grande appartement bourgeois, fireplace, parquet, near Champs-Élysées.' },
    { a: 'Carrer de Mallorca, 401',d: 'Eixample · Barcelona', r: 3, ar: 110, fl: 5,  tf: 8,  p: 680000,  c: 'EUR', t: PropertyType.APARTMENT, st: PropertyStatus.AVAILABLE, di: 'BUY' as const,  ds: 'Gaudí-era modernist building, original tile floors, terrace.' },
    { a: 'Kärntner Strasse, 14',   d: 'Innere Stadt · Wien', r: 2, ar: 88,  fl: 3,  tf: 5,  p: 540000,  c: 'EUR', t: PropertyType.APARTMENT, st: PropertyStatus.AVAILABLE, di: 'BUY' as const,  ds: 'Imperial-era building, recently restored, walk to Stephansdom.' },
    { a: 'Via Veneto, 56',         d: 'Centro · Roma',     r: 3, ar: 130, fl: 7,  tf: 9,  p: 920000,  c: 'EUR', t: PropertyType.APARTMENT, st: PropertyStatus.RESERVED,  di: 'BUY' as const,  ds: 'Luxury apartment near Villa Borghese, doorman, private parking.' },
    { a: 'Côte d\'Azur villa, Cap Ferrat', d: 'Saint-Jean-Cap-Ferrat', r: 6, ar: 380, fl: 1,  tf: 2,  p: 4200000, c: 'EUR', t: PropertyType.HOUSE,     st: PropertyStatus.AVAILABLE, di: 'BUY' as const,  ds: 'Belle Époque villa, sea view, infinity pool, 2000m² grounds.' },
    { a: 'вул. Європейська, 18',   d: 'Печерськ · Київ',   r: 2, ar: 68,  fl: 12, tf: 22, p: 4200000, c: 'UAH', t: PropertyType.APARTMENT, st: PropertyStatus.AVAILABLE, di: 'BUY' as const,  ds: '2-кімнатна в новобудові на Печерську, з виходом на Дніпро.' },
    { a: 'вул. Володимирська, 50', d: 'Шевченківський',    r: 1, ar: 35,  fl: 2,  tf: 5,  p: 1900000, c: 'UAH', t: PropertyType.APARTMENT, st: PropertyStatus.AVAILABLE, di: 'BUY' as const,  ds: 'Стара київська квартира з високими стелями, потребує ремонту.' },
    { a: 'вул. Лютеранська, 11',   d: 'Печерськ',          r: 3, ar: 92,  fl: 4,  tf: 6,  p: 6500000, c: 'UAH', t: PropertyType.APARTMENT, st: PropertyStatus.AVAILABLE, di: 'BUY' as const,  ds: 'Сталінка з ремонтом, вікна на парк.' },
    { a: 'вул. Полтавська, 25 (оренда)', d: 'Шевченківський', r: 2, ar: 60, fl: 7,  tf: 9,  p: 22000,   c: 'UAH', t: PropertyType.APARTMENT, st: PropertyStatus.AVAILABLE, di: 'RENT' as const, ds: '2-кімнатна біля метро Лук\'янівська, є парковка.' },
  ];
  const newProps: { id: string }[] = [];
  for (const mp of moreProps) {
    const existing = await prisma.property.findFirst({ where: { address: mp.a } });
    if (existing) { newProps.push({ id: existing.id }); continue; }
    const created = await prisma.property.create({
      data: {
        type: mp.t, dealIntent: mp.di, status: mp.st,
        district: mp.d, address: mp.a,
        rooms: mp.r, floor: mp.fl, totalFloors: mp.tf, area: mp.ar,
        price: mp.p, currency: mp.c, description: mp.ds,
      },
    });
    newProps.push({ id: created.id });
  }

  // ── More clients (mix Ukrainian + European, demo of phone formats) ─────────
  const moreClients = [
    // Italian
    { n: 'Marco Rossi',       p: '+390345111001', e: 'marco.rossi@gmail.com',     img: 70 },
    { n: 'Giulia Bianchi',    p: '+390346111002', e: 'g.bianchi@libero.it',       img: 71 },
    { n: 'Luca Esposito',     p: '+390347111003', e: 'luca.esposito@outlook.it',  img: 72 },
    { n: 'Francesca Romano',  p: '+390348111004', e: 'fromano@gmail.com',         img: 73 },
    { n: 'Davide Ferrari',    p: '+390349111005', e: 'd.ferrari@hotmail.com',     img: 74 },
    // French
    { n: 'Sophie Dubois',     p: '+330612345001', e: 'sophie.dubois@orange.fr',   img: 75 },
    { n: 'Pierre Martin',     p: '+330612345002', e: 'pm@laposte.net',            img: 76 },
    { n: 'Camille Laurent',   p: '+330612345003', e: 'camille.l@gmail.com',       img: 77 },
    { n: 'Antoine Moreau',    p: '+330612345004', e: 'antoine.moreau@free.fr',    img: 78 },
    // German
    { n: 'Hans Müller',       p: '+491711234001', e: 'h.mueller@web.de',          img: 64 },
    { n: 'Anna Schmidt',      p: '+491711234002', e: 'anna.schmidt@gmx.de',       img: 65 },
    // Spanish
    { n: 'Carlos García',     p: '+34612345001',  e: 'c.garcia@hotmail.es',       img: 66 },
    { n: 'María López',       p: '+34612345002',  e: 'maria.lopez@gmail.com',     img: 67 },
    // More UA
    { n: 'Олексій Левченко',  p: '+380671235021', e: 'levchenko.o@gmail.com',     img: 12 },
    { n: 'Катерина Овсієнко', p: '+380672235022', e: 'k.ovsienko@ukr.net',        img: 14 },
    { n: 'Денис Петренко',    p: '+380673235023', e: 'd.petrenko@gmail.com',      img: 17 },
    { n: 'Ольга Гриценко',    p: '+380674235024', e: 'olga.g@meta.ua',            img: 19 },
    { n: 'Артем Бабенко',     p: '+380675235025', e: 'a.babenko@gmail.com',       img: 21 },
    { n: 'Світлана Грищук',   p: '+380676235026', e: 's.hryshchuk@gmail.com',     img: 24 },
    { n: 'Тарас Лук\'яненко', p: '+380677235027', e: 't.lukianenko@ukr.net',      img: 27 },
    { n: 'Юрій Демченко',     p: '+380678235028', e: 'y.demchenko@gmail.com',     img: 31 },
    { n: 'Олеся Ярошук',      p: '+380679235029', e: 'olesya.y@meta.ua',          img: 36 },
    { n: 'Максим Хоменко',    p: '+380680235030', e: 'm.khomenko@gmail.com',      img: 42 },
    { n: 'Інна Андріяшко',    p: '+380681235031', e: 'inna.a@ukr.net',            img: 45 },
    { n: 'Роман Гавриленко',  p: '+380682235032', e: 'r.havrylenko@gmail.com',    img: 51 },
  ];
  const moreClientIds: string[] = [];
  for (let i = 0; i < moreClients.length; i++) {
    const c = moreClients[i];
    const r = await prisma.client.upsert({
      where: { primaryPhone: c.p },
      update: {},
      create: {
        fullName: c.n,
        primaryPhone: c.p,
        email: c.e,
        avatarUrl: `https://i.pravatar.cc/150?img=${c.img}`,
        // GDPR consent on ~30% — demo of toggle on detail card
        marketingConsent: i % 3 === 0,
        consentTimestamp: i % 3 === 0 ? daysAgo(Math.floor(Math.random() * 30)) : null,
        consentVersion: i % 3 === 0 ? '1.0' : null,
      },
    });
    moreClientIds.push(r.id);
  }

  // ── Demo flags on a few clients ────────────────────────────────────────────
  // Archive 2 clients (real estate: closed deals long past, kept for history)
  await prisma.client.updateMany({
    where: { primaryPhone: { in: ['+490346111002', '+380682235032'] } },
    data: { isArchived: true },
  });
  // Blacklist 1 client (the noisy / no-show one)
  await prisma.client.updateMany({
    where: { primaryPhone: '+380678235028' }, // Юрій Демченко
    data: { isBlacklisted: true },
  });

  // ── Bulk leads with realistic stage distribution ───────────────────────────
  // Target funnel: 40% NEW, 25% CONTACTED, 15% QUALIFIED, 10% SHOWING, 7% NEGOTIATION, 3% WON
  // 25 new leads
  const STAGES_WEIGHTED: Array<{ s: string; intent: 'BUY' | 'RENT'; ageDays: [number, number] }> = [
    { s: 'NEW',         intent: 'BUY',  ageDays: [0, 3] },   // x10
    { s: 'NEW',         intent: 'RENT', ageDays: [0, 2] },
    { s: 'CONTACTED',   intent: 'BUY',  ageDays: [2, 8] },   // x6
    { s: 'CONTACTED',   intent: 'RENT', ageDays: [1, 5] },
    { s: 'QUALIFIED',   intent: 'BUY',  ageDays: [5, 14] },  // x4
    { s: 'QUALIFIED',   intent: 'RENT', ageDays: [3, 7] },
    { s: 'SHOWING',     intent: 'BUY',  ageDays: [7, 20] },  // x3
    { s: 'NEGOTIATION', intent: 'BUY',  ageDays: [10, 30] }, // x2
    { s: 'WON',         intent: 'BUY',  ageDays: [20, 90] }, // x1 (will get a Deal)
  ];
  // Distribute clients across stages following weights
  const stagePlan = [
    ...Array(8).fill('NEW-B'),
    ...Array(2).fill('NEW-R'),
    ...Array(4).fill('CONTACTED-B'),
    ...Array(2).fill('CONTACTED-R'),
    ...Array(3).fill('QUALIFIED-B'),
    ...Array(1).fill('QUALIFIED-R'),
    ...Array(2).fill('SHOWING-B'),
    ...Array(2).fill('NEGOTIATION-B'),
    ...Array(1).fill('WON-B'),
  ];
  const agents = [r1, r2, r3]; // r4 (Pierre) is on vacation — no new assignments
  const srcKeys = Object.keys(sources);
  const buyPropIds = newProps.slice(0, 8).map((p) => p.id);
  const rentPropIds = newProps.filter((_, i) => i < 5).map((p) => p.id); // first 5 are RENT
  // Actually re-derive: look up by intent
  const buyProps = await prisma.property.findMany({ where: { dealIntent: 'BUY', status: { not: 'SOLD' } }, select: { id: true }, take: 30 });
  const rentProps = await prisma.property.findMany({ where: { dealIntent: 'RENT' }, select: { id: true }, take: 10 });
  void buyPropIds; void rentPropIds;

  const generatedLeads: { id: string; clientId: string; stage: string; agentId: string }[] = [];

  for (let i = 0; i < stagePlan.length && i < moreClientIds.length; i++) {
    const planKey = stagePlan[i];
    const [stage, intentLetter] = planKey.split('-');
    const intent: 'BUY' | 'RENT' = intentLetter === 'R' ? 'RENT' : 'BUY';
    const ageMap: Record<string, [number, number]> = {
      NEW:         [0, 3],
      CONTACTED:   [2, 8],
      QUALIFIED:   [5, 14],
      SHOWING:     [7, 20],
      NEGOTIATION: [10, 30],
      WON:         [20, 90],
    };
    const [minAge, maxAge] = ageMap[stage] ?? [0, 7];
    const age = minAge + Math.floor(Math.random() * (maxAge - minAge));
    const agent = agents[i % agents.length];
    const src = srcKeys[i % srcKeys.length];
    const pool = intent === 'RENT' ? rentProps : buyProps;
    // Don't attach a property to ~30% of NEW leads — they come with `interestNote` instead
    const useInterestNote = stage === 'NEW' && i % 3 === 0;
    const propId = !useInterestNote && pool.length > 0
      ? pool[i % pool.length].id
      : null;
    const clientId = moreClientIds[i];

    // Skip if client already has an active lead (dedup constraint on server)
    const existing = await prisma.lead.findFirst({
      where: { clientId, stage: { in: ['NEW', 'CONTACTED', 'QUALIFIED', 'SHOWING', 'NEGOTIATION'] } },
    });
    if (existing) {
      generatedLeads.push({ id: existing.id, clientId, stage: existing.stage, agentId: agent });
      continue;
    }

    const lead = await prisma.lead.create({
      data: {
        clientId,
        sourceId: sources[src],
        assignedUserId: agent,
        stage: stage as any,
        dealIntent: intent,
        interestPropertyId: propId,
        interestNote: useInterestNote
          ? ['Шукає 2-кімнатну з OLX, посилання прикріплено',
             'Цікавиться оголошенням з Instagram Stories',
             'Дзвонив про оголошення Facebook',
             'Цікавиться об\'єктом з DOM.RIA https://example.com/123'][i % 4]
          : null,
        priority: ['hot', 'warm', 'cold'][i % 3] as 'hot' | 'warm' | 'cold',
        stageChangedAt: daysAgo(age),
        lastActivityAt: daysAgo(Math.max(0, age - Math.floor(Math.random() * 3))),
        lostAt: null,
        createdAt: daysAgo(age + Math.floor(Math.random() * 5)),
      },
    });

    // 1-3 activities per lead, more for advanced stages.
    // Content is sampled from realistic message pools so timelines don't look
    // like templated copy-paste. Each entry is plausible WhatsApp/Telegram text
    // from a real Ukrainian/European real-estate workflow.
    const actCount = stage === 'NEW' ? 1 : stage === 'CONTACTED' ? 2 : stage === 'QUALIFIED' ? 3 : 4;
    const channels: ActivityType[] = ['CALL', 'WHATSAPP', 'TELEGRAM', 'EMAIL', 'NOTE'];

    // Inbound messages (client → agent)
    const inboundMsgs: string[] = intent === 'RENT'
      ? [
          'Доброго дня, цікавить вашe оголошення. Це ще доступно?',
          'Скільки кімнат? І чи можна з тваринами?',
          'Можна побачити фото вечірнього освітлення?',
          'А депозит який? І наскільки гнучкий торг?',
          'Коли можна подивитись? Я після 18:00 вільний.',
          'Власник зустріне чи через агента?',
        ]
      : [
          'Здравствуйте, цікавить ваш об\'єкт. Можна детальніше?',
          'Об\'єкт ще в продажу? Бачив на OLX.',
          'А що з документами? Готові до угоди?',
          'Скільки разів перепродувалось? І борги по комуналці?',
          'Розглядаю ще пару варіантів, але цей подобається. Коли можна подивитись?',
          'Власник готовий на торг? Бо ціна на верхній межі мого бюджету.',
        ];

    // Outbound messages (agent → client)
    const outboundMsgs: string[] = intent === 'RENT'
      ? [
          'Доброго дня! Так, актуально. Надсилаю детальну інформацію та фото.',
          'Об\'єкт у відмінному стані, останній ремонт 2024 року. Депозит — одна оренда.',
          'З тваринами обговорюємо з власником окремо. Якого розміру і скільки?',
          'Можу показати завтра о 19:00. Адреса прийде окремо за годину.',
          'Підготувала ще 2 варіанти у вашому бюджеті — скинути на пошту?',
          'Запам\'ятала. Якщо знизиться ціна або з\'явиться подібне — напишу одразу.',
        ]
      : [
          'Здравствуйте! Так, у продажу. Надсилаю опис та документи.',
          'Документи в порядку, готові до угоди. Власник перевірений, я з ним давно.',
          'Без боргів, остання перевірка ОСББ — місяць тому. Прикріплюю довідку.',
          'Зручно подивитись завтра о 16:00 чи післязавтра вранці? Власник готовий.',
          'По торгу — давайте обговоримо після показу. Думаю, знайдемо компроміс.',
          'Дякую за час. Якщо будуть питання — пишіть будь-коли.',
        ];

    const noteMsgs: string[] = [
      'Клієнт думає, обіцяв відповісти до п\'ятниці.',
      'Бюджет твердий, торг неможливий.',
      'Подивиться з дружиною, передзвонить у вихідні.',
      'Цікавиться лише з ремонтом — без ремонту не розглядає.',
      'Перевіряє іпотеку в банку, чекає рішення.',
      'Дзвонив тричі — не бере. Спробую написати у Viber.',
      'Передав власнику пропозицію по ціні, чекаємо відповідь.',
      'Готовий внести задаток, але хоче ще один показ.',
    ];

    const callTexts: string[] = intent === 'RENT'
      ? [
          'Перший контакт. Оренда на 6+ місяців, бюджет уточнено.',
          'Дзвонив за оголошенням. Готовий подивитись цього тижня.',
          'Запит підтверджено: 1-2 кімнати, центр, до 18 жовтня переїзд.',
          'Уточнили: депозит, домашні тварини, парковка. Все ок.',
        ]
      : [
          'Перший контакт. Купівля для себе, не інвестиція.',
          'Зворотній дзвінок. Уточнили бюджет, готові до показу.',
          'Розпитав про іпотеку. Має схвалення банку, торг можливий.',
          'Дзвонив за оголошенням. Розглядає 3-4 варіанти, наш — top.',
        ];

    const emailTexts: string[] = [
      'Надіслав презентацію об\'єкта в PDF та посилання на віртуальний тур.',
      'Підготував порівняльну таблицю з 3 варіантами — на пошту.',
      'Скинув документи власника та виписку з реєстру.',
      'Email з підбіркою об\'єктів у вашому бюджеті.',
    ];

    for (let j = 0; j < actCount; j++) {
      const isCall = j === 0;
      const ch = isCall ? ActivityType.CALL : channels[(j + i) % channels.length];
      const isOut = j > 0 && j % 2 === 1;
      const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

      let content: string;
      if (isCall) content = pick(callTexts);
      else if (ch === ActivityType.NOTE) content = pick(noteMsgs);
      else if (ch === ActivityType.EMAIL) content = pick(emailTexts);
      else content = isOut ? pick(outboundMsgs) : pick(inboundMsgs);

      await prisma.activity.create({
        data: {
          clientId,
          leadId: lead.id,
          userId: agent,
          type: ch,
          direction: j === 0 ? ActivityDirection.IN : (isOut ? ActivityDirection.OUT : ActivityDirection.IN),
          content,
          createdAt: daysAgo(age - j),
          metadata: isCall ? { durationSec: 60 + Math.floor(Math.random() * 240) } : null,
        },
      });
    }

    generatedLeads.push({ id: lead.id, clientId, stage, agentId: agent });
  }

  // ── Deals — close some WON leads with real Deal records ────────────────────
  const wonLeads = await prisma.lead.findMany({
    where: { stage: 'WON' },
    include: { client: true, interestProperty: true },
    take: 5,
  });
  for (const wl of wonLeads) {
    if (!wl.interestPropertyId || !wl.interestProperty) continue;
    const existing = await prisma.deal.findUnique({ where: { leadId: wl.id } }).catch(() => null);
    if (existing) continue;
    const amount = Number(wl.interestProperty.price);
    const pct = 3;
    const commission = Math.round((amount * pct) / 100 * 100) / 100;
    await prisma.deal.create({
      data: {
        leadId: wl.id,
        clientId: wl.clientId,
        propertyId: wl.interestPropertyId,
        agentId: wl.assignedUserId ?? r1,
        dealIntent: wl.dealIntent,
        amount,
        commissionPercent: pct,
        commissionAmount: commission,
        status: 'COMPLETED',
        stage: 'CLOSED_WON',
        closedAt: daysAgo(7 + Math.floor(Math.random() * 60)),
      },
    });
  }

  // ── OVERDUE tasks (some agents have a backlog — realistic) ─────────────────
  const overdueTasks = [
    { agent: r1, days: -2, title: 'Передзвонити по показу — Марко Россі (Roma)', type: TaskType.CALL },
    { agent: r1, days: -1, title: 'Уточнити по іпотеці — Олексій Левченко',       type: TaskType.FOLLOWUP },
    { agent: r2, days: -3, title: 'Договір купівлі-продажу — Sophie Dubois',      type: TaskType.CUSTOM },
    { agent: r2, days: -1, title: 'Зворотний зв\'язок після показу — Carlos García', type: TaskType.FOLLOWUP },
    { agent: r3, days: -2, title: 'Перший контакт — Hans Müller',                 type: TaskType.CALL },
  ];
  for (const t of overdueTasks) {
    const lead = generatedLeads.find((l) => l.agentId === t.agent);
    if (!lead) continue;
    const exists = await prisma.task.findFirst({ where: { title: t.title } });
    if (exists) continue;
    await prisma.task.create({
      data: {
        userId: t.agent,
        clientId: lead.clientId,
        leadId: lead.id,
        title: t.title,
        type: t.type,
        dueAt: daysAgo(-t.days), // negative days → past
        status: TaskStatus.OVERDUE,
      },
    });
  }

  // ── Notifications (mix of read/unread, types covered) ──────────────────────
  const notifSamples = [
    { user: r1, type: 'NEW_LEAD',      title: 'New lead assigned',         body: 'Marco Rossi — quartiere Centro Roma',          link: '/leads', read: false, ago: 0.5 },
    { user: r1, type: 'NEW_TASK',      title: 'Нова задача: Показ',        body: 'Показ Via Brera 18 завтра 15:00',              link: '/tasks', read: false, ago: 1 },
    { user: r1, type: 'NEW_LEAD_SLA',  title: 'SLA: новий лід',            body: 'Зателефонувати протягом 15 хв',                link: '/today', read: true,  ago: 2 },
    { user: r1, type: 'FOLLOWUP_DUE',  title: 'Пора зв\'язатись з клієнтом', body: '3 дні без активності — Sophie Dubois',       link: '/leads', read: true,  ago: 3 },
    { user: r2, type: 'NEW_LEAD',      title: 'Lead assigned to you',      body: 'Giulia Bianchi — apartment 2-bed Milano',      link: '/leads', read: false, ago: 0.2 },
    { user: r2, type: 'LEAD_IDLE',     title: 'Лід давно без руху',        body: '8 днів без активності — Pierre Martin',        link: '/leads', read: false, ago: 0.8 },
    { user: r2, type: 'NEW_MESSAGE',   title: 'New WhatsApp message',      body: 'Maria López asks about Calle Mayor 45',        link: '/inbox', read: true,  ago: 4 },
    { user: r3, type: 'NEW_LEAD',      title: 'New lead assigned',         body: 'Hans Müller — apartment Wien',                 link: '/leads', read: false, ago: 0.3 },
    { user: realtor1.id, type: 'DEAL_CLOSED_WON', title: 'Угода закрита', body: 'Андрій Мельник · 3.8M UAH комісія 3%',         link: '/deals', read: true,  ago: 5 },
  ];
  for (const n of notifSamples) {
    const exists = await prisma.notification.findFirst({
      where: { userId: n.user, title: n.title, body: n.body },
    });
    if (exists) continue;
    await prisma.notification.create({
      data: {
        userId: n.user,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        isRead: n.read,
        createdAt: new Date(Date.now() - n.ago * 86_400_000),
      },
    });
  }

  // ── Upcoming showings for the calendar view (next 14 days) ─────────────────
  const upcomingSchedule = [
    { ago: -1, hour: 10, agent: r1, pool: 'BUY' as const  },
    { ago: -1, hour: 14, agent: r2, pool: 'RENT' as const },
    { ago: -2, hour: 11, agent: r1, pool: 'BUY' as const  },
    { ago: -2, hour: 16, agent: r3, pool: 'RENT' as const },
    { ago: -3, hour: 12, agent: r2, pool: 'BUY' as const  },
    { ago: -5, hour: 15, agent: r1, pool: 'BUY' as const  },
    { ago: -7, hour: 11, agent: r3, pool: 'BUY' as const  },
  ];
  for (const sch of upcomingSchedule) {
    const pool = sch.pool === 'RENT' ? rentProps : buyProps;
    const candidates = generatedLeads.filter((l) => l.agentId === sch.agent);
    if (!candidates.length || !pool.length) continue;
    const lead = candidates[Math.floor(Math.random() * candidates.length)];
    const property = pool[Math.floor(Math.random() * pool.length)];
    const exists = await prisma.showing.findFirst({
      where: { clientId: lead.clientId, propertyId: property.id, status: ShowingStatus.SCHEDULED },
    });
    if (exists) continue;
    const when = new Date();
    when.setDate(when.getDate() - sch.ago);
    when.setHours(sch.hour, 0, 0, 0);
    await prisma.showing.create({
      data: {
        propertyId: property.id,
        clientId: lead.clientId,
        agentId: sch.agent,
        scheduledAt: when,
        durationMin: 60,
        status: ShowingStatus.SCHEDULED,
      },
    });
  }

  // Final count
  const counts = await Promise.all([
    prisma.user.count(),
    prisma.client.count(),
    prisma.property.count(),
    prisma.lead.count(),
    prisma.activity.count(),
    prisma.task.count(),
    prisma.showing.count(),
    prisma.deal.count(),
    prisma.notification.count(),
  ]);
  console.log(
    `✅ Seed complete: ${counts[0]} users · ${counts[1]} clients · ${counts[2]} properties · ` +
    `${counts[3]} leads · ${counts[4]} activities · ${counts[5]} tasks · ` +
    `${counts[6]} showings · ${counts[7]} deals · ${counts[8]} notifications`,
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
