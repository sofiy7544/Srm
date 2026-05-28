import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TemplatesService } from '../templates/templates.service';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
  ) {}

  async renderForDeal(dealId: string, templateId: string): Promise<{ html: string; subject: string }> {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { client: true, property: true, agent: true },
    });
    if (!deal) throw new NotFoundException('Сделка не найдена');

    const tpl = await this.prisma.contractTemplate.findUnique({ where: { id: templateId } });
    if (!tpl) throw new NotFoundException('Шаблон договора не найден');
    if (!tpl.isActive) throw new BadRequestException('Шаблон отключён');

    const vars = {
      deal: {
        id: deal.id,
        amount: Number(deal.amount).toLocaleString('uk-UA'),
        commissionPercent: deal.commissionPercent,
        commissionAmount: Number(deal.commissionAmount).toLocaleString('uk-UA'),
        createdAt: new Date(deal.createdAt).toLocaleDateString('uk-UA'),
      },
      client: deal.client,
      property: {
        address: deal.property.address,
        district: deal.property.district,
        rooms: deal.property.rooms,
        area: Number(deal.property.area),
      },
      agent: { fullName: deal.agent.fullName, email: deal.agent.email },
      today: new Date().toLocaleDateString('uk-UA'),
    };

    const body = this.templates.render(tpl.content, vars);
    const html = `<!doctype html>
<html lang="${tpl.language}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(tpl.name)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 2rem auto; padding: 1rem; line-height: 1.5; color: #111; }
  h1, h2, h3 { line-height: 1.2; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
  .header { display: flex; justify-content: space-between; margin-bottom: 2rem; }
  .signatures { margin-top: 3rem; display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
  .sig { border-top: 1px solid #000; padding-top: 0.5rem; min-height: 60px; }
  @media print { body { margin: 0; max-width: none; } button { display: none; } }
</style>
</head>
<body>
${body}
<div class="signatures">
  <div class="sig">Клиент: ${escapeHtml(deal.client.fullName)}<br/><small>Подпись: ____________________</small></div>
  <div class="sig">Агент: ${escapeHtml(deal.agent.fullName)}<br/><small>Подпись: ____________________</small></div>
</div>
</body>
</html>`;
    return { html, subject: tpl.name };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}
