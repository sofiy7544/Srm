import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ActivityDirection, ActivityType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import type { CurrentUserPayload } from '../auth/current-user.decorator';

@Injectable()
export class PresentationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async render(propertyId: string): Promise<string> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: { photos: { orderBy: { order: 'asc' } }, owner: { select: { fullName: true, email: true, phone: true } } },
    });
    if (!property) throw new NotFoundException('Объект не найден');

    const priceFmt = Number(property.price).toLocaleString('uk-UA');
    const areaFmt = Number(property.area).toLocaleString('uk-UA', { maximumFractionDigits: 1 });

    return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(property.address)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro", "Inter", system-ui, sans-serif;
    margin: 0; padding: 0; background: #f5f7fb; color: #111827; line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .container { max-width: 880px; margin: 0 auto; padding: 32px 16px; }
  .hero { position: relative; aspect-ratio: 16/9; border-radius: 16px; overflow: hidden;
          background: linear-gradient(135deg, #e0e7ff, #fce7f3); }
  .hero img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .hero-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.5) 0%, transparent 50%); }
  .hero-info { position: absolute; bottom: 24px; left: 24px; right: 24px; color: white; }
  .hero-price { font-size: 36px; font-weight: 700; letter-spacing: -0.02em; }
  .hero-address { font-size: 16px; opacity: 0.9; margin-top: 4px; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 999px; background: rgba(255,255,255,.95);
            color: #111827; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
            position: absolute; top: 16px; right: 16px; }
  .grid { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-top: 24px; }
  @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
  .card { background: white; border-radius: 14px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
  .card h2 { font-size: 16px; font-weight: 600; margin: 0 0 12px; letter-spacing: -0.01em; }
  .specs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .spec-label { font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; font-weight: 500; }
  .spec-value { font-size: 18px; font-weight: 600; margin-top: 2px; }
  .description { white-space: pre-wrap; color: #374151; font-size: 14px; }
  .photos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 16px; }
  .photos img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 10px; }
  .agent-card { background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; }
  .agent-card h2 { color: white; }
  .agent-name { font-size: 20px; font-weight: 600; }
  .agent-contact { font-size: 14px; opacity: 0.85; margin-top: 4px; }
  .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 32px; }
</style>
</head>
<body>
  <div class="container">
    <div class="hero">
      ${property.photos[0]
        ? `<img src="${escapeAttr(property.photos[0].url)}" alt="${escapeAttr(property.address)}" />`
        : ''}
      <div class="hero-overlay"></div>
      <div class="status">${statusLabel(property.status)}</div>
      <div class="hero-info">
        <div class="hero-price">${priceFmt} ${escapeHtml(property.currency)}</div>
        <div class="hero-address">${escapeHtml(property.address)}</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>Характеристики</h2>
        <div class="specs">
          <div><div class="spec-label">Тип</div><div class="spec-value">${typeLabel(property.type)}</div></div>
          <div><div class="spec-label">Район</div><div class="spec-value">${escapeHtml(property.district)}</div></div>
          ${property.rooms !== null ? `<div><div class="spec-label">Комнат</div><div class="spec-value">${property.rooms}</div></div>` : ''}
          <div><div class="spec-label">Площадь</div><div class="spec-value">${areaFmt} м²</div></div>
        </div>
        ${property.description ? `<h2 style="margin-top:20px">Описание</h2><div class="description">${escapeHtml(property.description)}</div>` : ''}
      </div>

      <div class="card agent-card">
        <h2>Ваш агент</h2>
        ${property.owner ? `<div class="agent-name">${escapeHtml(property.owner.fullName)}</div>
        <div class="agent-contact">${escapeHtml(property.owner.email)}</div>
        ${property.owner.phone ? `<div class="agent-contact">${escapeHtml(property.owner.phone)}</div>` : ''}
        ` : '<div class="agent-name">Команда CRM</div>'}
      </div>
    </div>

    ${property.photos.length > 1 ? `
      <div class="card" style="margin-top: 16px;">
        <h2>Галерея</h2>
        <div class="photos">
          ${property.photos.slice(1).map((p: any) => `<img src="${escapeAttr(p.url)}" alt="" />`).join('')}
        </div>
      </div>` : ''}

    <div class="footer">Презентация сгенерирована автоматически · ${new Date().toLocaleDateString('ru-RU')}</div>
  </div>
</body>
</html>`;
  }

  async sendByEmail(actor: CurrentUserPayload, propertyId: string, clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, fullName: true, email: true },
    });
    if (!client) throw new NotFoundException('Клиент не найден');
    if (!client.email) throw new BadRequestException('У клиента не указан email');
    if (!this.email.isConfigured()) {
      throw new BadRequestException('SMTP не настроен — заполните SMTP_* в .env');
    }

    const html = await this.render(propertyId);
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { address: true },
    });
    const subject = `Предложение по объекту: ${property?.address ?? 'недвижимость'}`;

    const ok = await this.email.send(client.email, subject, html);
    if (!ok) throw new BadRequestException('Не удалось отправить письмо');

    await this.prisma.activity.create({
      data: {
        clientId: client.id,
        userId: actor.userId,
        type: ActivityType.EMAIL,
        direction: ActivityDirection.OUT,
        content: `Отправлена презентация: ${property?.address}`,
        metadata: { propertyId, kind: 'presentation' } as Prisma.InputJsonValue,
      },
    });
    return { sent: true };
  }
}

function statusLabel(s: string): string {
  return {
    AVAILABLE: 'Свободен',
    IN_SHOWING: 'В показах',
    RESERVED: 'Задаток',
    SOLD: 'Продан',
    ARCHIVED: 'Архив',
  }[s] ?? s;
}

function typeLabel(t: string): string {
  return {
    APARTMENT: 'Квартира',
    HOUSE: 'Дом',
    COMMERCIAL: 'Коммерция',
    LAND: 'Участок',
  }[t] ?? t;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
