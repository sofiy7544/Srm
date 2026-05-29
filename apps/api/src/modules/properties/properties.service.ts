import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreatePropertyInput,
  UpdatePropertyInput,
  PropertyFilter,
} from '@crm/shared';
import type { PaginatedResult } from '../../common/pagination';

const PROPERTY_INCLUDE = {
  owner: { select: { id: true, fullName: true, email: true } },
  photos: { orderBy: { order: 'asc' as const } },
} satisfies Prisma.PropertyInclude;

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    filter: PropertyFilter,
    currentUserId?: string,
  ): Promise<PaginatedResult<Prisma.PropertyGetPayload<{ include: typeof PROPERTY_INCLUDE }>>> {
    const where: Prisma.PropertyWhereInput = {};

    if (filter.type) where.type = filter.type;
    if (filter.dealIntent) where.dealIntent = filter.dealIntent;
    if (filter.status) where.status = filter.status;
    if (filter.district) where.district = { contains: filter.district, mode: 'insensitive' };
    if (filter.roomsMin !== undefined) where.rooms = { gte: filter.roomsMin };
    if (filter.roomsMax !== undefined)
      where.rooms = { ...(where.rooms as object), lte: filter.roomsMax };
    if (filter.priceMin !== undefined) where.price = { gte: filter.priceMin };
    if (filter.priceMax !== undefined)
      where.price = { ...(where.price as object), lte: filter.priceMax };

    // "Private agent inventory" mode — agent sees only properties they own.
    if (filter.mine && currentUserId) {
      where.ownerUserId = currentUserId;
    } else if (filter.ownerUserId) {
      where.ownerUserId = filter.ownerUserId;
    }

    if (filter.search) {
      where.OR = [
        { address: { contains: filter.search, mode: 'insensitive' } },
        { district: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const skip = (filter.page - 1) * filter.pageSize;
    const take = filter.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        where,
        include: PROPERTY_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.property.count({ where }),
    ]);

    return { items, total, page: filter.page, pageSize: filter.pageSize };
  }

  async getById(id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: PROPERTY_INCLUDE,
    });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  async create(input: CreatePropertyInput, defaultOwnerId: string) {
    return this.prisma.property.create({
      data: {
        type: input.type,
        dealIntent: input.dealIntent,
        district: input.district,
        address: input.address,
        rooms: input.rooms,
        floor: input.floor,
        totalFloors: input.totalFloors,
        area: input.area,
        price: input.price,
        currency: input.currency,
        status: input.status,
        ownerUserId: input.ownerUserId ?? defaultOwnerId,
        description: input.description,
        features: (input.features ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
      include: PROPERTY_INCLUDE,
    });
  }

  async update(id: string, input: UpdatePropertyInput) {
    await this.getById(id);
    return this.prisma.property.update({
      where: { id },
      data: {
        type: input.type,
        dealIntent: input.dealIntent,
        district: input.district,
        address: input.address,
        rooms: input.rooms,
        floor: input.floor,
        totalFloors: input.totalFloors,
        area: input.area,
        price: input.price,
        currency: input.currency,
        status: input.status,
        ownerUserId: input.ownerUserId,
        description: input.description,
        features:
          input.features === undefined
            ? undefined
            : (input.features as Prisma.InputJsonValue),
      },
      include: PROPERTY_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.getById(id);
    await this.prisma.property.delete({ where: { id } });
    return { ok: true };
  }

  async addPhoto(
    propertyId: string,
    url: string,
    isCover = false,
    kind: 'PHOTO' | 'VIDEO' = 'PHOTO',
  ) {
    await this.getById(propertyId);
    const order = await this.prisma.propertyPhoto.count({ where: { propertyId } });
    return this.prisma.propertyPhoto.create({
      data: { propertyId, url, order, isCover, kind },
    });
  }

  async removePhoto(propertyId: string, photoId: string) {
    await this.prisma.propertyPhoto.deleteMany({
      where: { id: photoId, propertyId },
    });
    return { ok: true };
  }
}
