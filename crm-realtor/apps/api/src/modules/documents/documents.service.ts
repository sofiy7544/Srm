import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../auth/current-user.decorator';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(filter: { clientId?: string; dealId?: string; propertyId?: string }) {
    const where: Prisma.DocumentWhereInput = {};
    if (filter.clientId) where.clientId = filter.clientId;
    if (filter.dealId) where.dealId = filter.dealId;
    if (filter.propertyId) where.propertyId = filter.propertyId;
    return this.prisma.document.findMany({
      where,
      include: { uploadedBy: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(input: {
    clientId?: string; dealId?: string; propertyId?: string;
    type: DocumentType; fileUrl: string; originalName: string;
    mime: string; uploadedById: string;
  }) {
    return this.prisma.document.create({
      data: {
        clientId: input.clientId ?? null,
        dealId: input.dealId ?? null,
        propertyId: input.propertyId ?? null,
        type: input.type,
        fileUrl: input.fileUrl,
        originalName: input.originalName,
        mime: input.mime,
        uploadedById: input.uploadedById,
      },
    });
  }

  async remove(actor: CurrentUserPayload, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    const ok = actor.role === UserRole.ADMIN || actor.role === UserRole.MANAGER;
    if (!ok && doc.uploadedById !== actor.userId) {
      throw new ForbiddenException('No permission to delete this document');
    }
    return this.prisma.document.delete({ where: { id } });
  }
}
