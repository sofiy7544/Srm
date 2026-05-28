import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Locale, Prisma, UserRole } from '@prisma/client';
import Handlebars from 'handlebars';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../auth/current-user.decorator';

export interface TemplateInput {
  name: string;
  language: Locale;
  content: string;
  isActive?: boolean;
}

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.contractTemplate.findMany({
      orderBy: [{ language: 'asc' }, { name: 'asc' }],
    });
  }

  async getById(id: string) {
    const tpl = await this.prisma.contractTemplate.findUnique({ where: { id } });
    if (!tpl) throw new NotFoundException('Template not found');
    return tpl;
  }

  async create(actor: CurrentUserPayload, input: TemplateInput) {
    this.assertAdmin(actor);
    return this.prisma.contractTemplate.create({ data: input });
  }

  async update(actor: CurrentUserPayload, id: string, input: Partial<TemplateInput>) {
    this.assertAdmin(actor);
    await this.getById(id);
    return this.prisma.contractTemplate.update({
      where: { id },
      data: input as Prisma.ContractTemplateUpdateInput,
    });
  }

  async remove(actor: CurrentUserPayload, id: string) {
    this.assertAdmin(actor);
    await this.getById(id);
    await this.prisma.contractTemplate.delete({ where: { id } });
    return { ok: true };
  }

  render(content: string, vars: Record<string, unknown>): string {
    const tpl = Handlebars.compile(content, { noEscape: false });
    return tpl(vars);
  }

  private assertAdmin(actor: CurrentUserPayload) {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Только администратор может управлять шаблонами');
    }
  }
}
