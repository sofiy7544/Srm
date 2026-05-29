/**
 * One-time fix for templated/duplicate chat messages in seeded activities.
 *
 * The old seed loop created every lead's chat history from 3 hardcoded
 * sentences ("Повідомлення в whatsapp: уточнюємо деталі об'єкта" etc.) so
 * every client looked identical in the chat panel. This script finds those
 * exact templated rows and replaces them with sampled realistic messages.
 *
 *   pnpm --filter @crm/api exec tsx prisma/fix-duplicate-messages.ts
 */
import { PrismaClient, ActivityType, ActivityDirection } from '@prisma/client';

const prisma = new PrismaClient();

const inboundMsgs = [
  'Доброго дня, цікавить вашe оголошення. Це ще доступно?',
  'Здравствуйте, цікавить ваш об\'єкт. Можна детальніше?',
  'Скільки кімнат? І чи можна з тваринами?',
  'Можна побачити фото вечірнього освітлення?',
  'А депозит який? І наскільки гнучкий торг?',
  'Коли можна подивитись? Я після 18:00 вільний.',
  'Власник зустріне чи через агента?',
  'Об\'єкт ще в продажу? Бачив на OLX.',
  'А що з документами? Готові до угоди?',
  'Скільки разів перепродувалось? І борги по комуналці?',
  'Розглядаю ще пару варіантів, але цей подобається. Коли можна подивитись?',
  'Власник готовий на торг? Бо ціна на верхній межі мого бюджету.',
];

const outboundMsgs = [
  'Доброго дня! Так, актуально. Надсилаю детальну інформацію та фото.',
  'Об\'єкт у відмінному стані, останній ремонт 2024 року.',
  'З тваринами обговорюємо з власником окремо. Якого розміру і скільки?',
  'Можу показати завтра о 19:00. Адреса прийде окремо за годину.',
  'Підготувала ще 2 варіанти у вашому бюджеті — скинути на пошту?',
  'Якщо знизиться ціна або з\'явиться подібне — напишу одразу.',
  'Здравствуйте! Так, у продажу. Надсилаю опис та документи.',
  'Документи в порядку, готові до угоди. Власник перевірений.',
  'Без боргів, остання перевірка ОСББ — місяць тому. Прикріплюю довідку.',
  'Зручно подивитись завтра о 16:00 чи післязавтра вранці?',
  'По торгу — давайте обговоримо після показу. Думаю, знайдемо компроміс.',
  'Дякую за час. Якщо будуть питання — пишіть будь-коли.',
];

const noteMsgs = [
  'Клієнт думає, обіцяв відповісти до п\'ятниці.',
  'Бюджет твердий, торг неможливий.',
  'Подивиться з дружиною, передзвонить у вихідні.',
  'Цікавиться лише з ремонтом — без ремонту не розглядає.',
  'Перевіряє іпотеку в банку, чекає рішення.',
  'Дзвонив тричі — не бере. Спробую написати у Viber.',
  'Передав власнику пропозицію по ціні, чекаємо відповідь.',
  'Готовий внести задаток, але хоче ще один показ.',
];

const callTextsBuy = [
  'Перший контакт. Купівля для себе, не інвестиція.',
  'Зворотній дзвінок. Уточнили бюджет, готові до показу.',
  'Розпитав про іпотеку. Має схвалення банку, торг можливий.',
  'Дзвонив за оголошенням. Розглядає 3-4 варіанти, наш — top.',
];

const callTextsRent = [
  'Перший контакт. Оренда на 6+ місяців, бюджет уточнено.',
  'Дзвонив за оголошенням. Готовий подивитись цього тижня.',
  'Запит підтверджено: 1-2 кімнати, центр, до 18 жовтня переїзд.',
  'Уточнили: депозит, домашні тварини, парковка. Все ок.',
];

const emailTexts = [
  'Надіслав презентацію об\'єкта в PDF та посилання на віртуальний тур.',
  'Підготував порівняльну таблицю з 3 варіантами — на пошту.',
  'Скинув документи власника та виписку з реєстру.',
  'Email з підбіркою об\'єктів у вашому бюджеті.',
];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

async function main() {
  // Find all activities that were created by the old templated loop.
  const templatedActivities = await prisma.activity.findMany({
    where: {
      OR: [
        { content: { contains: 'уточнюємо деталі' } },
        { content: { contains: 'бюджет уточнюється' } },
        { content: { contains: 'обіцяв відповісти за 2 дні' } },
      ],
    },
    include: {
      lead: { select: { dealIntent: true } },
    },
  });

  console.log(`Found ${templatedActivities.length} templated activities to refresh.`);

  let updated = 0;
  for (const a of templatedActivities) {
    const isRent = a.lead?.dealIntent === 'RENT';
    let newContent: string;

    if (a.type === ActivityType.CALL) {
      newContent = pick(isRent ? callTextsRent : callTextsBuy);
    } else if (a.type === ActivityType.NOTE) {
      newContent = pick(noteMsgs);
    } else if (a.type === ActivityType.EMAIL) {
      newContent = pick(emailTexts);
    } else {
      // WHATSAPP / TELEGRAM / INSTAGRAM
      newContent = a.direction === ActivityDirection.OUT
        ? pick(outboundMsgs)
        : pick(inboundMsgs);
    }

    await prisma.activity.update({
      where: { id: a.id },
      data: { content: newContent },
    });
    updated += 1;
  }

  console.log(`✅ Updated ${updated} activities with varied realistic messages.`);
}

main()
  .catch((e) => {
    console.error('Fix failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
