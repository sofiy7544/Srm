import { Controller, Get, Header, Param, ParseUUIDPipe, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContractsService } from './contracts.service';

@Controller('contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get('deal/:dealId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async renderForDeal(
    @Param('dealId', ParseUUIDPipe) dealId: string,
    @Query('templateId', ParseUUIDPipe) templateId: string,
    @Res() res: Response,
  ) {
    const { html } = await this.contracts.renderForDeal(dealId, templateId);
    res.send(html);
  }
}
