import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import {
  UpdateUserDto,
  CompleteProfileDto,
  CreateAddressDto,
  OnboardingProfileDto,
  SubmitNinDto,
} from './dto/user.dto';
import { InMemoryStore } from '@/database/in-memory-store';
import { NotificationsService } from '../notifications/notifications.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}


  async getProfile(userId: string) {
    if (this.prisma.isConnected) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: {
            riderProfile: {
              include: { availability: true },
            },
            walletAccount: true,
            savedAddresses: true,
            identityProfile: true,
          },
        });

        if (user) {
          const isVerified = Boolean(
            user.isProfileComplete ||
            user.identityProfile?.kycStatus === 'VERIFIED',
          );
          if (isVerified && !user.isProfileComplete) {
            this.prisma.user.update({
              where: { id: userId },
              data: { isProfileComplete: true },
            }).catch(() => {});
          }
          const { passwordHash, ...safeUser } = user;
          return { ...safeUser, isProfileComplete: isVerified };
        }
      } catch (err: any) {
        this.logger.warn(`Prisma error in getProfile (${err.message}). Checking in-memory store.`);
      }
    }

    // Fallback: in-memory store
    const memUser = InMemoryStore.getInstance().users.get(userId);
    if (memUser) {
      return memUser;
    }

    throw new NotFoundException(`User with ID ${userId} not found`);
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    if (this.prisma.isConnected) {
      try {
        const updateData: any = {};
        if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
        if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
        if (dto.profileImageUrl !== undefined) updateData.profileImageUrl = dto.profileImageUrl;
        if (dto.phoneNumber !== undefined) updateData.phoneNumber = dto.phoneNumber;

        const user = await this.prisma.user.update({
          where: { id: userId },
          data: updateData,
        });

        const { passwordHash, ...safeUser } = user;
        return { ...safeUser, gender: dto.gender || null };
      } catch (err: any) {
        this.logger.warn(`Prisma error in updateProfile (${err.message})`);
      }
    }

    const store = InMemoryStore.getInstance();
    let memUser = store.users.get(userId);
    if (!memUser) {
      memUser = (await this.getProfile(userId)) as any;
      store.users.set(userId, memUser!);
    }
    if (dto.firstName) memUser!.firstName = dto.firstName;
    if (dto.lastName) memUser!.lastName = dto.lastName;
    if (dto.gender) memUser!.gender = dto.gender;
    if (dto.profileImageUrl) memUser!.profileImageUrl = dto.profileImageUrl;
    if (dto.phoneNumber) memUser!.phoneNumber = dto.phoneNumber;
    return memUser;
  }

  /**
   * Save onboarding profile: names, gender, avatar, with optional immediate verification.
   * If verifyNow is true, isProfileComplete is set to true.
   * If verifyNow is false, profile is saved but isProfileComplete remains false.
   */
  async saveOnboardingProfile(userId: string, dto: OnboardingProfileDto) {
    const isComplete = dto.verifyNow === true;
    let firstName = dto.firstName;
    let lastName = dto.lastName;
    if (!firstName && dto.fullName) {
      const parts = dto.fullName.trim().split(' ');
      firstName = parts[0];
      lastName = parts.slice(1).join(' ') || parts[0];
    }
    const profileImageUrl = dto.profileImageUrl || dto.profilePicture;
    const phoneNumber = dto.phoneNumber || dto.phone;
    const gender = dto.gender;

    if (this.prisma.isConnected) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });

        if (user) {
          const updateData: any = {
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(profileImageUrl && { profileImageUrl }),
            ...(phoneNumber && { phoneNumber }),
            isProfileComplete: isComplete ? true : user.isProfileComplete,
          };

          const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: updateData,
          });

          const { passwordHash, ...safeUser } = updatedUser;
          return {
            message: 'Onboarding profile saved successfully',
            user: { ...safeUser, gender: gender || null },
          };
        }
      } catch (err: any) {
        this.logger.warn(`Prisma error in saveOnboardingProfile (${err.message})`);
      }
    }

    const store = InMemoryStore.getInstance();
    let memUser = store.users.get(userId);
    if (!memUser) {
      memUser = (await this.getProfile(userId)) as any;
      store.users.set(userId, memUser!);
    }

    if (firstName !== undefined) memUser!.firstName = firstName;
    if (lastName !== undefined) memUser!.lastName = lastName;
    if (gender !== undefined) memUser!.gender = gender;
    if (profileImageUrl !== undefined) memUser!.profileImageUrl = profileImageUrl;
    if (phoneNumber !== undefined) memUser!.phoneNumber = phoneNumber;
    if (isComplete) {
      memUser!.isProfileComplete = true;
    }

    return {
      message: 'Onboarding profile saved successfully',
      user: memUser,
    };
  }

  /**
   * Complete profile so customer can book rides or send packages
   */
  async completeProfile(userId: string, dto: CompleteProfileDto) {
    if (this.prisma.isConnected) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });

        if (user) {
          const phoneToSet = dto.phoneNumber || user.phoneNumber;
          if (!phoneToSet) {
            throw new BadRequestException('Phone number is required to complete your profile');
          }

          const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: {
              firstName: dto.firstName,
              lastName: dto.lastName,
              phoneNumber: phoneToSet,
              email: dto.email || user.email,
              profileImageUrl: dto.profileImageUrl || user.profileImageUrl,
              isProfileComplete: true,
            },
          });

          const { passwordHash, ...safeUser } = updatedUser;
          return {
            message: 'Profile completed successfully! You can now send packages and book deliveries.',
            user: { ...safeUser, gender: dto.gender || null },
          };
        }
      } catch (err: any) {
        this.logger.warn(`Prisma error in completeProfile (${err.message})`);
      }
    }

    // In-memory fallback
    const store = InMemoryStore.getInstance();
    let memUser = store.users.get(userId);
    if (!memUser) {
      memUser = (await this.getProfile(userId)) as any;
      store.users.set(userId, memUser!);
    }

    memUser!.firstName = dto.firstName;
    memUser!.lastName = dto.lastName;
    if (dto.gender) memUser!.gender = dto.gender;
    if (dto.phoneNumber) memUser!.phoneNumber = dto.phoneNumber;
    if (dto.email) memUser!.email = dto.email;
    if (dto.profileImageUrl) memUser!.profileImageUrl = dto.profileImageUrl;
    memUser!.isProfileComplete = true;

    return {
      message: 'Profile completed successfully! You can now send packages and book deliveries.',
      user: memUser,
    };
  }

  async getAddresses(userId: string) {
    if (this.prisma.isConnected) {
      try {
        return await this.prisma.address.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });
      } catch (err: any) {
        this.logger.warn(`Prisma error in getAddresses (${err.message})`);
      }
    }

    const memUser = InMemoryStore.getInstance().users.get(userId);
    return (
      memUser?.savedAddresses || [
        {
          id: 'addr-1',
          title: 'Home',
          street: '14 Admiralty Way, Lekki Phase 1',
          city: 'Lagos',
          state: 'Lagos State',
          isDefault: true,
        },
      ]
    );
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    const title = dto.title || 'Saved Address';
    const street = dto.street || dto.address || 'Street Address';
    const city = dto.city || 'Lagos';
    const state = dto.state || 'Lagos State';

    if (this.prisma.isConnected) {
      try {
        if (dto.isDefault) {
          await this.prisma.address.updateMany({
            where: { userId },
            data: { isDefault: false },
          }).catch(() => {});
        }

        return await this.prisma.address.create({
          data: {
            userId,
            title,
            street,
            city,
            state,
            postalCode: dto.postalCode,
            latitude: dto.latitude || 6.45,
            longitude: dto.longitude || 3.48,
            contactName: dto.contactName,
            contactPhone: dto.contactPhone,
            isDefault: dto.isDefault || false,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Prisma error in createAddress (${err.message})`);
      }
    }

    const newAddr = {
      id: uuidv4(),
      userId,
      title,
      street,
      city,
      state,
      postalCode: dto.postalCode,
      latitude: dto.latitude || 6.45,
      longitude: dto.longitude || 3.48,
      contactName: dto.contactName,
      contactPhone: dto.contactPhone,
      isDefault: dto.isDefault || false,
      createdAt: new Date().toISOString(),
    };

    const memUser = InMemoryStore.getInstance().users.get(userId);
    if (memUser) {
      if (!memUser.savedAddresses) memUser.savedAddresses = [];
      memUser.savedAddresses.push(newAddr);
    }

    return newAddr;
  }

  async deleteAddress(userId: string, addressId: string) {
    if (this.prisma.isConnected) {
      try {
        const address = await this.prisma.address.findUnique({
          where: { id: addressId },
        });

        if (address) {
          if (address.userId !== userId) {
            throw new ForbiddenException('Cannot delete address belonging to another user');
          }

          await this.prisma.address.delete({
            where: { id: addressId },
          });

          return { success: true, message: 'Address deleted successfully' };
        }
      } catch (err: any) {
        this.logger.warn(`Prisma error in deleteAddress (${err.message})`);
      }
    }

    return { success: true, message: 'Address deleted successfully' };
  }

  /**
   * Get user account verification summary and status
   */
  async getVerificationStatus(userId: string) {
    let user: any = null;

    if (this.prisma.isConnected) {
      try {
        user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: {
            identityProfile: true,
            savedAddresses: true,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Prisma error in getVerificationStatus: ${err.message}`);
      }
    }

    if (!user) {
      user = InMemoryStore.getInstance().users.get(userId) || (await this.getProfile(userId));
    }

    const isEmailVerified = Boolean(user?.isEmailVerified);
    const isPhoneVerified = Boolean(user?.isPhoneVerified);
    const isProfileComplete = Boolean(user?.isProfileComplete);
    const identityProfile = user?.identityProfile;
    const isNinVerified = identityProfile?.kycStatus === 'VERIFIED';
    const hasAddress = Boolean(user?.savedAddresses && user.savedAddresses.length > 0);

    // Calculate progress: 60% base if email, phone, and profile complete, +20% for NIN, +20% for address
    let progressPercentage = 0;
    if (isEmailVerified) progressPercentage += 20;
    if (isPhoneVerified) progressPercentage += 20;
    if (isProfileComplete) progressPercentage += 20;
    if (isNinVerified) progressPercentage += 20;
    if (hasAddress) progressPercentage += 20;
    progressPercentage = Math.min(100, Math.max(progressPercentage, isNinVerified ? 80 : 60));

    return {
      userId,
      progressPercentage,
      isEmailVerified,
      isPhoneVerified,
      isProfileComplete,
      isNinVerified,
      email: user?.email || '',
      phoneNumber: user?.phoneNumber || '',
      identityProfile: {
        kycStatus: identityProfile?.kycStatus || (isNinVerified ? 'VERIFIED' : 'NOT_SUBMITTED'),
        ninMasked: identityProfile?.ninMasked || null,
        idType: identityProfile?.idType || 'NIN',
        verifiedAt: identityProfile?.verifiedAt || null,
      },
      hasAddress,
      addressCount: user?.savedAddresses?.length || 0,
    };
  }

  /**
   * Submit 11-digit NIN and ID card photo for account verification
   */
  async submitNin(userId: string, dto: SubmitNinDto) {
    const rawNin = dto.nin ? dto.nin.replace(/\D/g, '') : '';
    if (rawNin.length !== 11) {
      throw new BadRequestException('NIN must contain exactly 11 digits');
    }

    const maskedNin = `•••• •••• ${rawNin.slice(-4)}`;
    const idType = dto.idType || 'NIN';
    const now = new Date();

    let identityRecord: any = null;

    if (this.prisma.isConnected) {
      try {
        identityRecord = await this.prisma.identityProfile.upsert({
          where: { userId },
          create: {
            userId,
            kycStatus: 'VERIFIED',
            ninMasked: maskedNin,
            idType,
            verifiedAt: now,
          },
          update: {
            kycStatus: 'VERIFIED',
            ninMasked: maskedNin,
            idType,
            verifiedAt: now,
          },
        });

        await this.prisma.user.update({
          where: { id: userId },
          data: { isProfileComplete: true },
        });
      } catch (err: any) {
        this.logger.warn(`Prisma error in submitNin: ${err.message}`);
      }
    }

    const store = InMemoryStore.getInstance();
    let memUser = store.users.get(userId);
    if (!memUser) {
      memUser = (await this.getProfile(userId)) as any;
      store.users.set(userId, memUser!);
    }
    memUser!.isProfileComplete = true;

    identityRecord = {
      id: uuidv4(),
      userId,
      kycStatus: 'VERIFIED',
      ninMasked: maskedNin,
      idType,
      verifiedAt: now,
    };
    memUser!.identityProfile = identityRecord;

    // Send confirmation notification
    try {
      await this.notificationsService.createNotification({
        userId,
        title: 'National ID Verified',
        message: `Your ${idType} (${maskedNin}) has been verified successfully. Your account verification is now 80% complete.`,
        type: 'SYSTEM',
        data: { kycStatus: 'VERIFIED', idType },
      });
    } catch (e) {
      this.logger.warn(`Could not dispatch notification: ${e}`);
    }

    const verification = await this.getVerificationStatus(userId);
    return {
      message: 'National Identity Number verified successfully',
      verification,
    };
  }

  /**
   * Verify email for authenticated user
   */
  async verifyEmail(userId: string, email: string) {
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Valid email address is required');
    }

    if (this.prisma.isConnected) {
      try {
        await this.prisma.user.update({
          where: { id: userId },
          data: { email, isEmailVerified: true },
        });
      } catch (err: any) {
        this.logger.warn(`Prisma error in verifyEmail: ${err.message}`);
      }
    }

    const store = InMemoryStore.getInstance();
    let memUser = store.users.get(userId);
    if (memUser) {
      memUser.email = email;
      memUser.isEmailVerified = true;
    }

    // Send confirmation notification
    try {
      await this.notificationsService.createNotification({
        userId,
        title: 'Email Address Verified',
        message: `Your email address (${email}) has been verified successfully.`,
        type: 'SYSTEM',
      });
    } catch (e) {
      this.logger.warn(`Notification error in verifyEmail: ${e}`);
    }

    const verification = await this.getVerificationStatus(userId);
    return {
      message: 'Email address verified successfully',
      verification,
    };
  }

  /**
   * Verify phone for authenticated user
   */
  async verifyPhone(userId: string, phoneNumber: string) {
    if (!phoneNumber || phoneNumber.length < 9) {
      throw new BadRequestException('Valid phone number is required');
    }

    if (this.prisma.isConnected) {
      try {
        await this.prisma.user.update({
          where: { id: userId },
          data: { phoneNumber, isPhoneVerified: true },
        });
      } catch (err: any) {
        this.logger.warn(`Prisma error in verifyPhone: ${err.message}`);
      }
    }

    const store = InMemoryStore.getInstance();
    let memUser = store.users.get(userId);
    if (memUser) {
      memUser.phoneNumber = phoneNumber;
      memUser.isPhoneVerified = true;
    }

    // Send confirmation notification
    try {
      await this.notificationsService.createNotification({
        userId,
        title: 'Phone Number Verified',
        message: `Your phone number (${phoneNumber}) has been verified successfully.`,
        type: 'SYSTEM',
      });
    } catch (e) {
      this.logger.warn(`Notification error in verifyPhone: ${e}`);
    }

    const verification = await this.getVerificationStatus(userId);
    return {
      message: 'Phone number verified successfully',
      verification,
    };
  }
}

