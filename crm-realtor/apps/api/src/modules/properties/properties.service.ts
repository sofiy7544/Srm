import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PropertyStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreatePropertyInput,
  UpdatePropertyInput,
  PropertyFilter,
} from '@crm/shared';
import type { PaginatedResult } from '../../common/pagination';

const PROPERTY_INCLUDE = {
  owner: { select: { id: true, fullName: true, email: true } },
  sellerClient: { select: { id: true, fullName: true, primaryPhone: true, type: true } },
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
    return this.prisma.$transaction(async (tx) => {
      const property = await tx.property.create({
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
          sellerClientId: input.sellerClientId ?? null,
          description: input.description,
          features: (input.features ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
        include: PROPERTY_INCLUDE,
      });
      // Первая точка истории цены — базовая линия для аналитики.
      await tx.propertyPriceHistory.create({
        data: {
          propertyId: property.id,
          price: property.price,
          currency: property.currency,
          changedById: input.ownerUserId ?? defaultOwnerId,
        },
      });
      return property;
    });
  }

  async update(id: string, input: UpdatePropertyInput, changedById?: string) {
    const current = await this.getById(id);
    return this.prisma.$transaction(async (tx) => {
      const property = await tx.property.update({
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
          sellerClientId: input.sellerClientId,
          description: input.description,
          features:
            input.features === undefined
              ? undefined
              : (input.features as Prisma.InputJsonValue),
        },
        include: PROPERTY_INCLUDE,
      });
      // Пишем историю только если цена реально изменилась.
      if (input.price !== undefined && !current.price.equals(property.price)) {
        await tx.propertyPriceHistory.create({
          data: {
            propertyId: id,
            price: property.price,
            currency: property.currency,
            changedById: changedById ?? null,
          },
        });
      }
      return property;
    });
  }

  /** История изменения цены объекта (новые сверху). */
  async priceHistory(id: string) {
    await this.getById(id);
    return this.prisma.propertyPriceHistory.findMany({
      where: { propertyId: id },
      orderBy: { changedAt: 'desc' },
      include: { changedBy: { select: { id: true, fullName: true } } },
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

  /**
   * МАТЧИНГ: подходящие объекты под предпочтения клиента.
   * Соединяет ClientPreferences (бюджет/район/комнаты/тип/intent) с доступными
   * объектами. Возвращает отсортированный по цене список + score совпадения.
   */
  async matchForClient(clientId: string) {
    const prefs = await this.prisma.clientPreferences.findUnique({
      where: { clientId },
    });
    if (!prefs) return { matches: [], reason: 'no_preferences' as const };

    const where: Prisma.PropertyWhereInput = {
      status: PropertyStatus.AVAILABLE,
    };
    if (prefs.propertyType) where.type = prefs.propertyType;
    if (prefs.dealIntent) where.dealIntent = prefs.dealIntent;
    if (prefs.priceMin) where.price = { gte: prefs.priceMin };
    if (prefs.priceMax)
      where.price = { ...(where.price as object), lte: prefs.priceMax };
    if (prefs.roomsMin) where.rooms = { gte: prefs.roomsMin };
    if (prefs.roomsMax)
      where.rooms = { ...(where.rooms as object), lte: prefs.roomsMax };
    if (prefs.areaMin) where.area = { gte: prefs.areaMin };
    if (prefs.areaMax)
      where.area = { ...(where.area as object), lte: prefs.areaMax };
    if (prefs.districts.length > 0) where.district = { in: prefs.districts };

    const matches = await this.prisma.property.findMany({
      where,
      include: PROPERTY_INCLUDE,
      orderBy: { price: 'asc' },
      take: 50,
    });
    return { matches, count: matches.length };
  }

  /**
   * МАТЧИНГ (обратный): клиенты-покупатели, чьи предпочтения подходят под объект.
   * Для риелтора — «кому предложить этот объект».
   */
  async matchForProperty(propertyId: string) {
    const p = await this.getById(propertyId);
    const candidates = await this.prisma.clientPreferences.findMany({
      where: {
        AND: [
          { OR: [{ propertyType: null }, { propertyType: p.type }] },
          { OR: [{ dealIntent: null }, { dealIntent: p.dealIntent }] },
          { OR: [{ priceMin: null }, { priceMin: { lte: p.price } }] },
          { OR: [{ priceMax: null }, { priceMax: { gte: p.price } }] },
          { OR: [{ roomsMin: null }, { roomsMin: { lte: p.rooms ?? 0 } }] },
          { OR: [{ roomsMax: null }, { roomsMax: { gte: p.rooms ?? 0 } }] },
        ],
      },
      include: {
        client: {
          select: { id: true, fullName: true, primaryPhone: true, type: true, assignedUserId: true },
        },
      },
      take: 50,
    });
    // Districts фильтруем в памяти (пустой = клиент готов на любой район).
    const matches = candidates.filter(
      (c) => c.districts.length === 0 || c.districts.includes(p.district),
    );
    return { matches: matches.map((c) => c.client), count: matches.length };
  }
}
