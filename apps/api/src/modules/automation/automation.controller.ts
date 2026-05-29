import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { Prisma, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';

const ruleSchema = z.object({
  name: z.string().min(1).max(120),
  condition: z.record(z.string(), z.unknown()),
  action: z.record(z.string(), z.unknown()),
  priority: z.number().int().min(0).max(1000).default(100),
  isActive: z.boolean().default(true),
});
const updateRuleSchema = ruleSchema.partial();
type RuleInput = z.infer<typeof ruleSchema>;
type UpdateRuleInput = z.infer<typeof updateRuleSchema>;

@Controller('automation-rules')
@UseGuards(JwtAuthGuard)
export class AutomationRulesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.automationRule.findMany({ orderBy: { priority: 'asc' } });
  }

  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(ruleSchema)) body: RuleInput,
  ) {
    this.assertAdmin(user);
    return this.prisma.automationRule.create({
      data: {
        name: body.name,
        condition: body.condition as Prisma.InputJsonValue,
        action: body.action as Prisma.InputJsonValue,
        priority: body.priority,
        isActive: body.isActive,
      },
    });
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateRuleSchema)) body: UpdateRuleInput,
  ) {
    this.assertAdmin(user);
    return this.prisma.automationRule.update({
      where: { id },
      data: {
        name: body.name,
        condition: body.condition as Prisma.InputJsonValue | undefined,
        action: body.action as Prisma.InputJsonValue | undefined,
        priority: body.priority,
        isActive: body.isActive,
      },
    });
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.assertAdmin(user);
    return this.prisma.automationRule.delete({ where: { id } });
  }

  private assertAdmin(user: CurrentUserPayload) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Только администратор может управлять правилами');
    }
  }
}
