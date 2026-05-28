import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SourcesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.source.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
