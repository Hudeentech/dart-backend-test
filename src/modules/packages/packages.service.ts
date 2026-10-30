import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import {
  CreatePackageDto,
  SavePackageDraftDto,
} from './dto/package.dto';
import { nanoid } from 'nanoid';
import { OrderStatus, PackageCategory } from '@prisma/client';
import { InMemoryStore } from '@/database/in-memory-store';
import { v4 as uuidv4 } from 'uuid';
import { HashUtil } from '@/common/utils/hash.util';

@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
  ) {}

  async listDrafts(userId: string) {
    if (this.prisma.isConnected) {
      return this.prisma.packageDraft.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });
    }

    return InMemoryStore.getInstance().packageDrafts.get(userId) || [];
  }

  async getDraft(userId: string, draftId: string) {
    if (this.prisma.isConnected) {
      const draft = await this.prisma.packageDraft.findFirst({
        where: { id: draftId, userId },
      });
      if (!draft) {
        throw new NotFoundException('Package draft not found');
      }
      return draft;
    }

    const draft = (InMemoryStore.getInstance().packageDrafts.get(userId) || [])
      .find((item) => item.id === draftId);
    if (!draft) {
      throw new NotFoundException('Package draft not found');
    }
    return draft;
  }

  async createDraft(userId: string, dto: SavePackageDraftDto) {
    if (this.prisma.isConnected) {
      return this.prisma.packageDraft.create({
        data: { userId, data: dto.data },
      });
    }

    const store = InMemoryStore.getInstance();
    const now = new Date();
    const draft = {
      id: uuidv4(),
      userId,
      data: dto.data,
      createdAt: now,
      updatedAt: now,
    };
    store.packageDrafts.set(userId, [
      draft,
      ...(store.packageDrafts.get(userId) || []),
    ]);
    return draft;
  }

  async updateDraft(userId: string, draftId: string, dto: SavePackageDraftDto) {
    if (this.prisma.isConnected) {
      const draft = await this.prisma.packageDraft.findFirst({
        where: { id: draftId, userId },
        select: { id: true },
      });
      if (!draft) {
        throw new NotFoundException('Package draft not found');
      }
      return this.prisma.packageDraft.update({
        where: { id: draftId },
        data: { data: dto.data },
      });
    }

    const store = InMemoryStore.getInstance();
    const drafts = store.packageDrafts.get(userId) || [];
    const index = drafts.findIndex((draft) => draft.id === draftId);
    if (index === -1) {
      throw new NotFoundException('Package draft not found');
    }
    const updated = { ...drafts[index], data: dto.data, updatedAt: new Date() };
    drafts[index] = updated;
    store.packageDrafts.set(userId, drafts);
    return updated;
  }

  async deleteDraft(userId: string, draftId: string) {
    if (this.prisma.isConnected) {
      const result = await this.prisma.packageDraft.deleteMany({
        where: { id: draftId, userId },
      });
      if (result.count === 0) {
        throw new NotFoundException('Package draft not found');
      }
      return { success: true, deletedIds: [draftId] };
    }

    const store = InMemoryStore.getInstance();
    const drafts = store.packageDrafts.get(userId) || [];
    const remaining = drafts.filter((draft) => draft.id !== draftId);
    if (remaining.length === drafts.length) {
      throw new NotFoundException('Package draft not found');
    }
    store.packageDrafts.set(userId, remaining);
    return { success: true, deletedIds: [draftId] };
  }

  async deleteDrafts(userId: string, draftIds: string[]) {
    if (this.prisma.isConnected) {
      const drafts = await this.prisma.packageDraft.findMany({
        where: { userId, id: { in: draftIds } },
        select: { id: true },
      });
      const deletedIds = drafts.map((draft) => draft.id);
      if (deletedIds.length > 0) {
        await this.prisma.packageDraft.deleteMany({
          where: { userId, id: { in: deletedIds } },
        });
      }
      const foundIds = new Set(deletedIds);
      return {
        success: true,
        deletedIds,
        skippedIds: draftIds.filter((id) => !foundIds.has(id)),
      };
    }

    const store = InMemoryStore.getInstance();
    const drafts = store.packageDrafts.get(userId) || [];
    const foundIds = new Set(
      drafts.filter((draft) => draftIds.includes(draft.id)).map((draft) => draft.id),
    );
    store.packageDrafts.set(
      userId,
      drafts.filter((draft) => !foundIds.has(draft.id)),
    );
    return {
      success: true,
      deletedIds: [...foundIds],
      skippedIds: draftIds.filter((id) => !foundIds.has(id)),
    };
  }

  async createPackage(userId: string, dto: CreatePackageDto) {
    let user: any = null;
    if (this.prisma.isConnected) {
      try {
        user = await this.prisma.user.findUnique({
          where: { id: userId },
        });
      } catch (err: any) {
        // fallback
      }
    }

    if (!user) {
      user = InMemoryStore.getInstance().users.get(userId);
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (
      !user.firstName?.trim() ||
      !user.lastName?.trim() ||
      !user.phoneNumber?.trim()
    ) {
      throw new ForbiddenException({
        code: 'PROFILE_INCOMPLETE',
        message:
          'You must complete your profile (name and phone number) before creating a package or booking a delivery.',
      });
    }

    const parseAddr = (addr: any) => {
      if (!addr) {
        return { street: 'Pickup Point', city: 'Lagos', state: 'Lagos State', latitude: 6.4474, longitude: 3.4723 };
      }
      if (typeof addr === 'string') {
        return { street: addr, city: 'Lagos', state: 'Lagos State', latitude: 6.4474, longitude: 3.4723 };
      }
      return {
        title: addr.title,
        street: addr.street || addr.address || 'Location Point',
        city: addr.city || 'Lagos',
        state: addr.state || 'Lagos State',
        postalCode: addr.postalCode,
        latitude: addr.latitude || 6.4474,
        longitude: addr.longitude || 3.4723,
        contactName: addr.contactName,
        contactPhone: addr.contactPhone,
      };
    };

    const pickupAddressData = parseAddr(dto.pickupAddress);
    const destinationAddressData = parseAddr(dto.destinationAddress || dto.dropoffAddress || dto.recipientAddress);
    const weightKg = dto.weightKg || dto.weight || 1.0;
    const category = (dto.category || (dto.type as any) || PackageCategory.PARCEL) as PackageCategory;

    // 1. Authoritative price calculation
    const quote = this.pricingService.calculateQuote({
      pickupLat: pickupAddressData.latitude,
      pickupLng: pickupAddressData.longitude,
      destinationLat: destinationAddressData.latitude,
      destinationLng: destinationAddressData.longitude,
      weightKg,
      category,
      isFragile: dto.isFragile,
      isSensitive: dto.isSensitive,
    });

    const orderNumber = `DART-${nanoid(8).toUpperCase()}`;
    const trackingId = `TRK-${nanoid(10).toUpperCase()}`;

    if (!this.prisma.isConnected) {
      const orderResult = {
        id: uuidv4(),
        orderNumber,
        trackingId,
        customerId: userId,
        status: OrderStatus.DRAFT,
        basePrice: quote.basePrice,
        distancePrice: quote.distancePrice,
        weightPrice: quote.weightPrice,
        surgePrice: quote.surgePrice,
        totalPrice: quote.totalPrice,
        platformFee: quote.platformFee,
        riderSettlementFee: quote.riderSettlementFee,
        distanceKm: quote.distanceKm,
        estimatedMinutes: quote.estimatedMinutes,
        pickupAddress: pickupAddressData,
        destinationAddress: destinationAddressData,
        createdAt: new Date().toISOString(),
      };
      return {
        ...orderResult,
        order: orderResult,
      };
    }

    // 2. Atomically create pickup address, destination address, package, items, and draft order
    return this.prisma.$transaction(async (tx) => {
      const pickupAddress = await tx.address.create({
        data: {
          userId,
          title: pickupAddressData.title || 'Pickup Location',
          street: pickupAddressData.street,
          city: pickupAddressData.city,
          state: pickupAddressData.state,
          postalCode: pickupAddressData.postalCode,
          latitude: pickupAddressData.latitude,
          longitude: pickupAddressData.longitude,
          contactName: pickupAddressData.contactName,
          contactPhone: pickupAddressData.contactPhone,
        },
      });

      const destinationAddress = await tx.address.create({
        data: {
          userId,
          title: destinationAddressData.title || 'Delivery Destination',
          street: destinationAddressData.street,
          city: destinationAddressData.city,
          state: destinationAddressData.state,
          postalCode: destinationAddressData.postalCode,
          latitude: destinationAddressData.latitude,
          longitude: destinationAddressData.longitude,
          contactName: destinationAddressData.contactName,
          contactPhone: destinationAddressData.contactPhone,
        },
      });

      const pkg = await tx.package.create({
        data: {
          creatorId: userId,
          name: dto.name,
          description: dto.description,
          category,
          weightKg,
          isFragile: dto.isFragile,
          isSensitive: dto.isSensitive,
          photoUrl: dto.photoUrl,
          valueAmount: dto.valueAmount || null,
          items: dto.items && dto.items.length > 0 ? {
            create: dto.items.map((item) => ({
              name: item.name,
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || null,
            })),
          } : undefined,
        },
      });

      const order = await tx.order.create({
        data: {
          orderNumber,
          trackingId,
          customerId: userId,
          packageId: pkg.id,
          pickupAddressId: pickupAddress.id,
          destinationAddressId: destinationAddress.id,
          status: OrderStatus.DRAFT,
          basePrice: quote.basePrice,
          distancePrice: quote.distancePrice,
          weightPrice: quote.weightPrice,
          surgePrice: quote.surgePrice,
          totalPrice: quote.totalPrice,
          platformFee: quote.platformFee,
          riderSettlementFee: quote.riderSettlementFee,
          distanceKm: quote.distanceKm,
          estimatedMinutes: quote.estimatedMinutes,
        },
        include: {
          package: {
            include: { items: true },
          },
          pickupAddress: true,
          destinationAddress: true,
        },
      });

      // Initial delivery event
      await tx.deliveryEvent.create({
        data: {
          orderId: order.id,
          status: OrderStatus.DRAFT,
          description: 'Package created and order drafted with authoritative quote.',
          actorId: userId,
        },
      });

      // Pre-generate secure handover confirmation code
      const rawCode = HashUtil.generateNumericCode(5);
      const codeHash = HashUtil.hashToken(rawCode);
      const codeExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      await tx.deliveryConfirmationCode.create({
        data: {
          orderId: order.id,
          codeHash,
          code: rawCode,
          expiresAt: codeExpiresAt,
        },
      });

      return {
        ...order,
        order,
        handoverCode: rawCode,
      };
    });
  }

  async getPackageById(userId: string, packageId: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      include: {
        items: true,
        order: {
          include: {
            pickupAddress: true,
            destinationAddress: true,
            deliveryEvents: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!pkg) {
      throw new NotFoundException('Package not found');
    }

    if (pkg.creatorId !== userId) {
      throw new ForbiddenException('Access to this package is forbidden');
    }

    return pkg;
  }

  async listUserPackages(userId: string) {
    if (!this.prisma.isConnected) {
      return [];
    }
    return this.prisma.package.findMany({
      where: { creatorId: userId },
      include: {
        items: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            trackingId: true,
            status: true,
            totalPrice: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ----------------------------------------------------
  // LINKED INBOUND PACKAGES
  // ----------------------------------------------------

  private async ensureDefaultInboundPackages(userId: string) {
    // Dummy seeding disabled to allow testing with real user packages only
    return;
  }

  async linkInboundPackage(userId: string, dto: any) {
    if (this.prisma.isConnected) {
      return this.prisma.inboundPackage.upsert({
        where: {
          userId_trackingId: {
            userId,
            trackingId: dto.trackingId,
          },
        },
        update: {
          title: dto.title || 'Inbound Package',
          store: dto.store || '',
          category: dto.category || 'PARCEL',
          courier: dto.courier || 'Dart Express',
          status: dto.status || 'In-Transit',
          fromLocation: dto.fromLocation || 'Distribution Center',
          toLocation: dto.toLocation || 'Local Destination Hub',
          isArrived: Boolean(dto.isArrived),
          arrivedDate: dto.arrivedDate || null,
          pickupTerminal: dto.pickupTerminal || null,
          fragileNote: dto.fragileNote || null,
          tracks: dto.tracks || undefined,
          payUrl: dto.payUrl || '',
        },
        create: {
          userId,
          trackingId: dto.trackingId,
          title: dto.title || 'Inbound Package',
          store: dto.store || '',
          category: dto.category || 'PARCEL',
          courier: dto.courier || 'Dart Express',
          shippedDate:
            dto.shippedDate ||
            new Date().toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
          estimatedArrival:
            dto.estimatedArrival ||
            new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
          fromLocation: dto.fromLocation || 'Distribution Center',
          toLocation: dto.toLocation || 'Local Destination Hub',
          status: dto.status || 'In-Transit',
          isArrived: Boolean(dto.isArrived),
          arrivedDate: dto.arrivedDate || null,
          pickupTerminal: dto.pickupTerminal || null,
          fragileNote: dto.fragileNote || null,
          tracks: dto.tracks || [
            {
              actionName: 'Package linked to customer account',
              msgEng: 'Customer added tracking number to Dart active monitoring',
              time: new Date().toISOString().replace('T', ' ').slice(0, 19),
              location: dto.fromLocation || 'Logistics Origin',
              scanSource: 'Customer Link',
            },
          ],
          payUrl: dto.payUrl || '',
        },
      });
    }

    await this.ensureDefaultInboundPackages(userId);
    const store = InMemoryStore.getInstance();
    const existing = store.inboundPackages.get(userId) || [];

    const newPkg: any = {
      id: dto.id || `inbound-${uuidv4()}`,
      userId,
      trackingId: dto.trackingId,
      title: dto.title || 'Inbound Package',
      store: dto.store || '',
      category: dto.category || 'PARCEL',
      courier: dto.courier || 'Dart Express',
      shippedDate:
        dto.shippedDate ||
        new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      estimatedArrival:
        dto.estimatedArrival ||
        new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      fromLocation: dto.fromLocation || 'Distribution Center',
      toLocation: dto.toLocation || 'Local Destination Hub',
      status: dto.status || 'In-Transit',
      isArrived: dto.isArrived || false,
      arrivedDate: dto.arrivedDate || null,
      pickupTerminal: dto.pickupTerminal || null,
      fragileNote: dto.fragileNote || null,
      tracks: dto.tracks || [
        {
          actionName: 'Package linked to customer account',
          msgEng: 'Customer added tracking number to Dart active monitoring',
          time: new Date().toISOString().replace('T', ' ').slice(0, 19),
          location: dto.fromLocation || 'Logistics Origin',
          scanSource: 'Customer Link',
        },
      ],
      payUrl: dto.payUrl || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updated = [newPkg, ...existing.filter((p) => p.trackingId !== dto.trackingId)];
    store.inboundPackages.set(userId, updated);

    return newPkg;
  }

  async listInboundPackages(userId: string) {
    if (this.prisma.isConnected) {
      await this.ensureDefaultInboundPackages(userId);
      return this.prisma.inboundPackage.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    }

    await this.ensureDefaultInboundPackages(userId);
    const store = InMemoryStore.getInstance();
    return store.inboundPackages.get(userId) || [];
  }

  async getInboundPackage(userId: string, id: string) {
    if (this.prisma.isConnected) {
      const item = await this.prisma.inboundPackage.findFirst({
        where: {
          userId,
          OR: [{ id }, { trackingId: id }],
        },
      });
      if (!item) {
        throw new NotFoundException('Inbound package not found');
      }
      return item;
    }

    await this.ensureDefaultInboundPackages(userId);
    const store = InMemoryStore.getInstance();
    const list = store.inboundPackages.get(userId) || [];
    const item = list.find((p) => p.id === id || p.trackingId === id);
    if (!item) {
      throw new NotFoundException('Inbound package not found');
    }
    return item;
  }

  async unlinkInboundPackage(userId: string, id: string) {
    if (this.prisma.isConnected) {
      const existing = await this.prisma.inboundPackage.findFirst({
        where: {
          userId,
          OR: [{ id }, { trackingId: id }],
        },
      });

      if (!existing) {
        return { success: true, message: 'Inbound package not found or already unlinked' };
      }

      const nonDeletable = ['In-Transit', 'Pending', 'IN_TRANSIT', 'PENDING'];
      if (nonDeletable.includes(existing.status)) {
        throw new BadRequestException('Cannot delete or unlink an inbound package that is pending or in-transit.');
      }

      await this.prisma.inboundPackage.delete({
        where: { id: existing.id },
      });
      return { success: true, message: 'Inbound package unlinked successfully' };
    }

    await this.ensureDefaultInboundPackages(userId);
    const store = InMemoryStore.getInstance();
    const list = store.inboundPackages.get(userId) || [];
    const existing = list.find((p) => p.id === id || p.trackingId === id);
    if (existing && ['In-Transit', 'Pending', 'IN_TRANSIT', 'PENDING'].includes(existing.status)) {
      throw new BadRequestException('Cannot delete or unlink an inbound package that is pending or in-transit.');
    }
    const filtered = list.filter((p) => p.id !== id && p.trackingId !== id);
    store.inboundPackages.set(userId, filtered);
    return { success: true, message: 'Inbound package unlinked successfully' };
  }

  async unlinkInboundPackages(userId: string, ids: string[]) {
    const nonDeletableStatuses = ['In-Transit', 'Pending', 'IN_TRANSIT', 'PENDING'];

    if (this.prisma.isConnected) {
      const packages = await this.prisma.inboundPackage.findMany({
        where: { userId, id: { in: ids } },
        select: { id: true, status: true },
      });
      const deletableIds = packages
        .filter((pkg) => !nonDeletableStatuses.includes(pkg.status))
        .map((pkg) => pkg.id);
      const skippedIds = ids.filter((id) => !deletableIds.includes(id));

      if (deletableIds.length > 0) {
        await this.prisma.inboundPackage.deleteMany({
          where: { userId, id: { in: deletableIds } },
        });
      }
      return { success: true, deletedIds: deletableIds, skippedIds };
    }

    const store = InMemoryStore.getInstance();
    const packages = store.inboundPackages.get(userId) || [];
    const deletableIds = packages
      .filter(
        (pkg) =>
          ids.includes(pkg.id) && !nonDeletableStatuses.includes(pkg.status),
      )
      .map((pkg) => pkg.id);
    const deletableSet = new Set(deletableIds);
    store.inboundPackages.set(
      userId,
      packages.filter((pkg) => !deletableSet.has(pkg.id)),
    );
    return {
      success: true,
      deletedIds: deletableIds,
      skippedIds: ids.filter((id) => !deletableSet.has(id)),
    };
  }

  async trackInboundPackage(trackingId: string) {
    const id = trackingId.trim();
    const today = new Date().toISOString().replace('T', ' ').slice(0, 19);

    let courier = 'SpeedAF Express';
    if (id.startsWith('TRK') || id.startsWith('DART')) {
      courier = 'Dart Express';
    } else if (id.startsWith('MV') || id.includes('ALI')) {
      courier = 'AliExpress';
    } else if (id.startsWith('DHL')) {
      courier = 'DHL Express';
    } else if (id.startsWith('FDX') || id.startsWith('FX')) {
      courier = 'FedEx';
    }

    return {
      success: true,
      data: [
        {
          mailNo: id,
          courier,
          title: `${courier} Inbound Shipment (${id})`,
          category: id.toLowerCase().includes('doc') ? 'DOCUMENTS' : 'PARCEL',
          origin: 'Nigeria Clearance Hub',
          destination: 'Distribution DC-BNI CENTRAL',
          payUrl: '',
          tracks: [
            {
              actionName: 'Arrived at distribution terminal',
              msgEng:
                'Shipment has arrived at distribution terminal and is being prepped for dispatch',
              time: today,
              location: 'Distribution DC-BNI CENTRAL',
              scanSource: 'Inbound Scan',
            },
            {
              actionName: 'Customs clearance completed',
              msgEng: 'Shipment customs inspection completed without duties outstanding',
              time: new Date(Date.now() - 12 * 3600000)
                .toISOString()
                .replace('T', ' ')
                .slice(0, 19),
              location: 'Nigeria Clearance Hub',
              scanSource: 'Customs Scan',
            },
            {
              actionName: 'In transit to destination facility',
              msgEng: 'En-route to regional delivery hub',
              time: new Date(Date.now() - 24 * 3600000)
                .toISOString()
                .replace('T', ' ')
                .slice(0, 19),
              location: 'Aviation Logistics Gateway',
              scanSource: 'Departure Scan',
            },
          ],
        },
      ],
    };
  }
}
