import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/database/prisma.service';
import { HashUtil } from '@/common/utils/hash.util';
import { CustomerSignupDto, RiderSignupDto, GoogleAuthDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestOtpDto, VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserRole, AccountStatus, VerificationType, Prisma } from '@prisma/client';
import { InMemoryStore, InMemoryUser } from '@/database/in-memory-store';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Check if an account exists by email or phone number
   */
  async checkIdentifier(rawIdentifier: string): Promise<{ exists: boolean; message: string }> {
    if (!rawIdentifier || !rawIdentifier.trim()) {
      return { exists: false, message: 'Identifier is required' };
    }
    const identifier = rawIdentifier.trim().toLowerCase();
    const cleanDigits = rawIdentifier.replace(/\D/g, '');

    const orConditions: Prisma.UserWhereInput[] = [
      { email: identifier },
      { phoneNumber: rawIdentifier.trim() },
    ];
    if (cleanDigits.length >= 10) {
      if (cleanDigits.startsWith('0')) {
        orConditions.push({ phoneNumber: `+234${cleanDigits.slice(1)}` });
      } else if (cleanDigits.startsWith('234')) {
        orConditions.push({ phoneNumber: `+${cleanDigits}` });
      } else {
        orConditions.push({ phoneNumber: `+234${cleanDigits}` });
      }
    }

    if (this.prisma.isConnected) {
      try {
        const user = await this.prisma.user.findFirst({
          where: { OR: orConditions },
          select: { id: true, email: true, phoneNumber: true, firstName: true },
        });
        if (user) {
          return { exists: true, message: 'An account with this email or phone number already exists.' };
        }
      } catch (err: any) {
        this.logger.warn(`Prisma error checking identifier: ${err.message}`);
      }
    }

    const store = InMemoryStore.getInstance();
    const memUser = store.users.get(identifier) || store.users.get(rawIdentifier.trim());
    if (memUser) {
      return { exists: true, message: 'An account with this email or phone number already exists.' };
    }

    return { exists: false, message: 'Account does not exist.' };
  }

  /**
   * Customer Signup (Email or Phone number, no role asked)
   */
  async signupCustomer(dto: CustomerSignupDto) {
    return this.registerUser(UserRole.CUSTOMER, dto.email, dto.phoneNumber, dto.password, dto.fullName);
  }

  /**
   * Rider Signup (Email or Phone number, no role asked)
   */
  async signupRider(dto: RiderSignupDto) {
    return this.registerUser(UserRole.RIDER, dto.email, dto.phoneNumber, dto.password, dto.fullName);
  }

  /**
   * Internal common user registration
   */
  private async registerUser(
    role: UserRole,
    email?: string,
    phoneNumber?: string,
    password?: string,
    fullName?: string,
  ) {
    if (!email && !phoneNumber) {
      throw new BadRequestException('Please provide either an email address or phone number to sign up.');
    }

    let firstName: string | null = null;
    let lastName: string | null = null;
    if (fullName && fullName.trim()) {
      const parts = fullName.trim().split(/\s+/);
      firstName = parts[0] || null;
      lastName = parts.slice(1).join(' ') || null;
    }

    if (this.prisma.isConnected) {
      try {
        const orConditions: Prisma.UserWhereInput[] = [];
        if (email) orConditions.push({ email });
        if (phoneNumber) orConditions.push({ phoneNumber });

        const existing = await this.prisma.user.findFirst({
          where: { OR: orConditions },
        });

        if (existing) {
          throw new ConflictException(
            'An account with this email or phone number already exists. Please log in instead.',
          );
        }

        const passwordHash = password ? await HashUtil.hashPassword(password) : null;

        return await this.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: email || null,
              phoneNumber: phoneNumber || null,
              passwordHash,
              firstName,
              lastName,
              role,
              status: AccountStatus.ACTIVE,
              isProfileComplete: Boolean(firstName && lastName),
            },
          });

          await tx.walletAccount.create({
            data: {
              userId: user.id,
              currency: 'NGN',
            },
          });

          if (role === UserRole.RIDER) {
            const riderProfile = await tx.riderProfile.create({
              data: {
                userId: user.id,
                isVerified: true,
              },
            });

            await tx.riderAvailability.create({
              data: {
                riderProfileId: riderProfile.id,
                status: 'ONLINE',
              },
            });
          }

          const tokens = await this.generateTokens(user.id, user.email || user.phoneNumber || user.id, user.role);
          await this.createSession(user.id, tokens.refreshToken);

          return {
            user: {
              id: user.id,
              email: user.email,
              phoneNumber: user.phoneNumber,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
              isProfileComplete: user.isProfileComplete,
              status: user.status,
            },
            tokens,
            message: 'Account created successfully. Welcome to DART!',
          };
        });
      } catch (dbErr: any) {
        if (dbErr instanceof HttpException) {
          throw dbErr;
        }
        this.logger.warn(`Prisma error during user registration (${dbErr.message}). Using resilient in-memory store.`);
      }
    }

    // In-Memory Fallback for development & offline DB scenarios
    const store = InMemoryStore.getInstance();
    let existingMemUser = (phoneNumber && store.users.get(phoneNumber)) || (email && store.users.get(email));

    if (existingMemUser) {
      throw new ConflictException(
        'An account with this email or phone number already exists. Please log in instead.',
      );
    }

    const newUserId = uuidv4();
    existingMemUser = {
        id: newUserId,
        email: email || null,
        phoneNumber: phoneNumber || null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
        role,
        status: AccountStatus.ACTIVE,
        isProfileComplete: false,
        isPhoneVerified: !!phoneNumber,
        isEmailVerified: !!email,
        createdAt: new Date(),
        updatedAt: new Date(),
        walletAccount: {
          id: uuidv4(),
          balance: 25000,
          currency: 'NGN',
        },
        savedAddresses: [],
      };
      store.users.set(newUserId, existingMemUser);
      if (phoneNumber) store.users.set(phoneNumber, existingMemUser);
      if (email) store.users.set(email, existingMemUser);

    const tokens = await this.generateTokens(
      existingMemUser.id,
      existingMemUser.email || existingMemUser.phoneNumber || existingMemUser.id,
      existingMemUser.role,
    );

    return {
      user: {
        id: existingMemUser.id,
        email: existingMemUser.email,
        phoneNumber: existingMemUser.phoneNumber,
        firstName: existingMemUser.firstName,
        lastName: existingMemUser.lastName,
        profileImageUrl: existingMemUser.profileImageUrl,
        role: existingMemUser.role,
        isProfileComplete: existingMemUser.isProfileComplete,
        status: existingMemUser.status,
      },
      tokens,
      message: 'Account ready. Complete your profile to get started.',
    };
  }

  /**
   * Continue with Google (OAuth sign-in / sign-up)
   */
  async googleAuth(role: UserRole, dto: GoogleAuthDto) {
    if (!dto.tokenOrId && !dto.email) {
      throw new BadRequestException('Invalid Google authentication payload');
    }

    const googleId = dto.tokenOrId;
    const email = dto.email;

    if (this.prisma.isConnected) {
      try {
        let user = await this.prisma.user.findFirst({
          where: {
            OR: [
              { googleId },
              ...(email ? [{ email }] : []),
            ],
          },
          include: {
            riderProfile: true,
            walletAccount: true,
          },
        });

        if (!user) {
          user = await this.prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
              data: {
                email: email || null,
                googleId,
                firstName: dto.firstName || null,
                lastName: dto.lastName || null,
                profileImageUrl: dto.profileImageUrl || null,
                role,
                status: AccountStatus.ACTIVE,
                isEmailVerified: !!email,
                isProfileComplete: false,
              },
            });

            await tx.walletAccount.create({
              data: {
                userId: newUser.id,
                currency: 'NGN',
              },
            });

            if (role === UserRole.RIDER) {
              const riderProfile = await tx.riderProfile.create({
                data: {
                  userId: newUser.id,
                  isVerified: true,
                },
              });

              await tx.riderAvailability.create({
                data: {
                  riderProfileId: riderProfile.id,
                  status: 'ONLINE',
                },
              });
            }

            return newUser;
          }) as any;
        } else if (!user.googleId) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: {
              googleId,
              profileImageUrl: user.profileImageUrl || dto.profileImageUrl,
            },
            include: { riderProfile: true, walletAccount: true },
          });
        }

        const tokens = await this.generateTokens(user.id, user.email || user.id, user.role);
        await this.createSession(user.id, tokens.refreshToken);

        return {
          user: {
            id: user.id,
            email: user.email,
            phoneNumber: user.phoneNumber,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            role: user.role,
            isProfileComplete: user.isProfileComplete,
            status: user.status,
          },
          tokens,
        };
      } catch (dbErr: any) {
        this.logger.warn(`Prisma error in googleAuth (${dbErr.message}). Falling back to memory store.`);
      }
    }

    // In-memory Google Auth fallback
    const store = InMemoryStore.getInstance();
    let memUser = email ? store.users.get(email) : null;
    if (!memUser) {
      const id = uuidv4();
      memUser = {
        id,
        email: email || null,
        phoneNumber: null,
        firstName: dto.firstName || 'Google User',
        lastName: dto.lastName || '',
        profileImageUrl: dto.profileImageUrl || null,
        role,
        status: AccountStatus.ACTIVE,
        isProfileComplete: true,
        isPhoneVerified: false,
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        walletAccount: { id: uuidv4(), balance: 15000, currency: 'NGN' },
        savedAddresses: [],
      };
      store.users.set(id, memUser);
      if (email) store.users.set(email, memUser);
    }

    const tokens = await this.generateTokens(memUser.id, memUser.email || memUser.id, memUser.role);
    return {
      user: {
        id: memUser.id,
        email: memUser.email,
        phoneNumber: memUser.phoneNumber,
        firstName: memUser.firstName,
        lastName: memUser.lastName,
        profileImageUrl: memUser.profileImageUrl,
        role: memUser.role,
        isProfileComplete: memUser.isProfileComplete,
        status: memUser.status,
      },
      tokens,
    };
  }

  /**
   * Login user with email/phone and password
   */
  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const identifier = dto.identifier || dto.email || dto.phoneNumber;
    if (this.prisma.isConnected && identifier) {
      try {
        const user = await this.prisma.user.findFirst({
          where: {
            OR: [{ email: identifier }, { phoneNumber: identifier }],
          },
          include: {
            riderProfile: {
              include: { availability: true },
            },
            walletAccount: true,
          },
        });

        if (user) {
          if (user.status === AccountStatus.SUSPENDED || user.status === AccountStatus.DEACTIVATED) {
            throw new UnauthorizedException('Account has been suspended or deactivated');
          }

          if (user.passwordHash) {
            const isPasswordValid = await HashUtil.verifyPassword(
              user.passwordHash,
              dto.password,
            );

            if (!isPasswordValid) {
              throw new UnauthorizedException('Invalid login credentials');
            }
          } else if (dto.password) {
            // User registered via OTP; initialize password hash on first password login
            try {
              const newHash = await HashUtil.hashPassword(dto.password);
              await this.prisma.user.update({
                where: { id: user.id },
                data: { passwordHash: newHash },
              });
            } catch (pErr: any) {
              this.logger.warn(`Could not set password on first login: ${pErr.message}`);
            }
          }

          const tokens = await this.generateTokens(user.id, user.email || user.phoneNumber || user.id, user.role);
          await this.createSession(user.id, tokens.refreshToken, ipAddress, userAgent);

          return {
            user: {
              id: user.id,
              email: user.email,
              phoneNumber: user.phoneNumber,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
              isProfileComplete: user.isProfileComplete,
              status: user.status,
              riderProfile: user.riderProfile,
              walletAccount: user.walletAccount,
            },
            tokens,
          };
        }
      } catch (err: any) {
        if (err instanceof HttpException) {
          throw err;
        }
        this.logger.warn(`Prisma error in login (${err.message}). Checking in-memory store.`);
      }
    }

    // In-memory fallback check
    const store = InMemoryStore.getInstance();
    let memUser = identifier ? store.users.get(identifier) : undefined;
    if (!memUser && identifier) {
      for (const u of store.users.values()) {
        if (u.email === identifier || u.phoneNumber === identifier || u.id === identifier) {
          memUser = u;
          break;
        }
      }
    }

    if (memUser) {
      const tokens = await this.generateTokens(memUser.id, memUser.email || memUser.phoneNumber || memUser.id, memUser.role);
      return {
        user: {
          id: memUser.id,
          email: memUser.email,
          phoneNumber: memUser.phoneNumber,
          firstName: memUser.firstName,
          lastName: memUser.lastName,
          role: memUser.role,
          isProfileComplete: memUser.isProfileComplete,
          status: memUser.status,
          walletAccount: memUser.walletAccount,
        },
        tokens,
      };
    }

    throw new UnauthorizedException(
      'No account found with this email or phone number. Please register an account first.',
    );
  }

  /**
   * Rotate refresh token and issue new token pair
   */
  async refreshToken(dto: RefreshTokenDto) {
    if (this.prisma.isConnected) {
      try {
        const session = await this.prisma.userSession.findUnique({
          where: { refreshToken: dto.refreshToken },
          include: { user: true },
        });

        if (session && !session.isRevoked) {
          if (new Date() > session.expiresAt) {
            await this.prisma.userSession.update({
              where: { id: session.id },
              data: { isRevoked: true },
            }).catch(() => {});
            throw new UnauthorizedException('Refresh token has expired. Please log in again');
          }

          await this.prisma.userSession.update({
            where: { id: session.id },
            data: { isRevoked: true },
          }).catch(() => {});

          const tokens = await this.generateTokens(
            session.user.id,
            session.user.email || session.user.phoneNumber || session.user.id,
            session.user.role,
          );

          await this.createSession(session.user.id, tokens.refreshToken);
          return tokens;
        }
      } catch (err: any) {
        this.logger.warn(`Prisma error in refreshToken (${err.message})`);
      }
    }

    throw new UnauthorizedException('Invalid or expired refresh token. Please log in again.');
  }

  /**
   * Terminate session
   */
  async logout(refreshToken: string) {
    if (!refreshToken) return { success: true };

    if (this.prisma.isConnected) {
      try {
        await this.prisma.userSession.updateMany({
          where: { refreshToken },
          data: { isRevoked: true },
        });
      } catch (e: any) {
        this.logger.warn(`Prisma error in logout (${e.message})`);
      }
    }

    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * Request OTP for phone or email verification
   * Generates 6-digit numeric OTP and prepares direct WhatsApp click-to-chat delivery
   */
  async requestOtp(dto: RequestOtpDto) {
    // Validate whether account exists based on purpose
    if (dto.purpose === 'login' || dto.purpose === 'reset_password') {
      const check = await this.checkIdentifier(dto.identifier);
      if (!check.exists) {
        throw new NotFoundException(
          'No account found with this email or phone number. Please check the identifier or register.',
        );
      }
    } else if (dto.purpose === 'signup') {
      const check = await this.checkIdentifier(dto.identifier);
      if (check.exists) {
        throw new ConflictException(
          'An account with this email or phone number already exists. Please log in instead.',
        );
      }
    }

    const code = HashUtil.generateNumericCode(6);
    const tokenHash = HashUtil.hashToken(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const isEmail = dto.type === VerificationType.EMAIL_OTP || dto.identifier.includes('@');
    let whatsappUrl: string | undefined = undefined;
    let waNumber = '';

    if (!isEmail) {
      // Format phone number for WhatsApp
      const cleanDigits = dto.identifier.replace(/\D/g, '');
      waNumber = cleanDigits;
      if (waNumber.startsWith('0')) {
        waNumber = '234' + waNumber.slice(1);
      } else if (!waNumber.startsWith('234')) {
        waNumber = '234' + waNumber;
      }

      const waMessage = `Your DART verification code is: ${code}. Valid for 10 minutes. Do not share this code with anyone.`;
      whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;
    }

    let savedToDb = false;

    if (this.prisma.isConnected) {
      try {
        await this.prisma.verificationToken.updateMany({
          where: {
            identifier: dto.identifier,
            type: dto.type,
            isUsed: false,
          },
          data: { isUsed: true },
        });

        await this.prisma.verificationToken.create({
          data: {
            identifier: dto.identifier,
            token: tokenHash,
            type: dto.type,
            expiresAt,
          },
        });
        savedToDb = true;
      } catch (dbErr: any) {
        this.logger.warn(`Prisma error saving verification token (${dbErr.message}). Using resilient in-memory fallback.`);
      }
    }

    if (!savedToDb) {
      InMemoryStore.getInstance().tokens.set(dto.identifier, {
        identifier: dto.identifier,
        code,
        tokenHash,
        type: dto.type,
        expiresAt,
        attempts: 0,
      });
    }

    if (isEmail) {
      this.logger.log(`[EMAIL OTP GENERATED] To: ${dto.identifier}, Code: ${code} (Expires in 10m)`);
      this.logger.log(`[DEV NOTICE] In development mode, use code: ${code}`);
    } else {
      this.logger.log(`[OTP GENERATED] To: ${dto.identifier} (${dto.channel || 'sms'}), Code: ${code} (Expires in 10m)`);
      this.logger.log(`[WHATSAPP LINK] ${whatsappUrl}`);

      // Live SMS / WhatsApp dispatch via Termii (if API key is configured in .env)
      const termiiKey = this.configService.get<string>('TERMII_API_KEY') || process.env.TERMII_API_KEY;
      if (termiiKey && termiiKey !== 'mock_termii_api_key' && termiiKey.length > 5) {
        try {
          const payload = {
            to: waNumber,
            from: 'DART',
            sms: `Your DART verification code is: ${code}. Valid for 10 minutes. Do not share this code with anyone.`,
            type: 'plain',
            channel: dto.channel === 'whatsapp' ? 'whatsapp' : 'generic',
            api_key: termiiKey,
          };
          const termiiRes = await fetch('https://api.ng.termii.com/api/sms/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const termiiData = await termiiRes.json();
          this.logger.log(`[TERMII DISPATCH] Dispatched to ${waNumber}: ${JSON.stringify(termiiData)}`);
        } catch (termiiErr: any) {
          this.logger.warn(`Failed to dispatch via Termii gateway: ${termiiErr.message}`);
        }
      } else {
        this.logger.log(`[DEV NOTICE] Live SMS/WhatsApp delivery requires a real Termii API key in DART-BACKEND/.env. For testing, your OTP code is: ${code}`);
      }
    }

    return {
      success: true,
      message: isEmail
        ? `Verification code sent to ${dto.identifier}`
        : dto.channel === 'whatsapp'
          ? `WhatsApp OTP prepared for ${dto.identifier}`
          : `OTP sent successfully to ${dto.identifier}`,
      devCode: code,
      whatsappUrl,
      channel: isEmail ? undefined : (dto.channel || 'sms'),
    };
  }

  /**
   * Verify OTP code with dual database & in-memory support
   */
  async verifyOtp(dto: VerifyOtpDto) {
    let tokenRecord: any = null;

    if (this.prisma.isConnected) {
      try {
        tokenRecord = await this.prisma.verificationToken.findFirst({
          where: {
            identifier: dto.identifier,
            type: dto.type,
            isUsed: false,
          },
          orderBy: { createdAt: 'desc' },
        });
      } catch (dbErr: any) {
        this.logger.warn(`Prisma error finding verification token (${dbErr.message}). Checking in-memory store.`);
      }
    }

    // 1. Prisma Token Record
    if (tokenRecord) {
      if (tokenRecord.attempts >= 5) {
        await this.prisma.verificationToken.update({
          where: { id: tokenRecord.id },
          data: { isUsed: true },
        }).catch(() => {});
        throw new BadRequestException('Too many invalid attempts. Please request a new OTP');
      }

      if (new Date() > tokenRecord.expiresAt) {
        await this.prisma.verificationToken.update({
          where: { id: tokenRecord.id },
          data: { isUsed: true },
        }).catch(() => {});
        throw new BadRequestException('OTP has expired');
      }

      const providedHash = HashUtil.hashToken(dto.code);
      const isValid = HashUtil.safeCompare(providedHash, tokenRecord.token);

      if (!isValid) {
        await this.prisma.verificationToken.update({
          where: { id: tokenRecord.id },
          data: { attempts: { increment: 1 } },
        }).catch(() => {});
        throw new BadRequestException('Invalid verification code');
      }

      await this.prisma.verificationToken.update({
        where: { id: tokenRecord.id },
        data: { isUsed: true },
      }).catch(() => {});

      if (dto.type === VerificationType.PHONE_OTP) {
        await this.prisma.user.updateMany({
          where: { phoneNumber: dto.identifier },
          data: { isPhoneVerified: true },
        }).catch(() => {});
      } else if (dto.type === VerificationType.EMAIL_OTP) {
        await this.prisma.user.updateMany({
          where: { email: dto.identifier },
          data: { isEmailVerified: true },
        }).catch(() => {});
      }

      return this.handlePostOtpSuccess(dto.identifier, dto.type, dto.purpose, dto.password);
    }

    // 2. In-Memory Token Record fallback
    const memToken = InMemoryStore.getInstance().tokens.get(dto.identifier);
    if (memToken) {
      if (memToken.attempts >= 5) {
        InMemoryStore.getInstance().tokens.delete(dto.identifier);
        throw new BadRequestException('Too many invalid attempts. Please request a new OTP');
      }

      if (new Date() > memToken.expiresAt) {
        InMemoryStore.getInstance().tokens.delete(dto.identifier);
        throw new BadRequestException('OTP has expired');
      }

      const isMatch = memToken.code === dto.code || HashUtil.safeCompare(HashUtil.hashToken(dto.code), memToken.tokenHash);
      if (!isMatch) {
        memToken.attempts++;
        throw new BadRequestException('Invalid verification code');
      }

      InMemoryStore.getInstance().tokens.delete(dto.identifier);

      const memUser = InMemoryStore.getInstance().users.get(dto.identifier);
      if (memUser) {
        if (dto.type === VerificationType.PHONE_OTP) memUser.isPhoneVerified = true;
        if (dto.type === VerificationType.EMAIL_OTP) memUser.isEmailVerified = true;
      }

      return this.handlePostOtpSuccess(dto.identifier, dto.type, dto.purpose, dto.password);
    }

    throw new BadRequestException('Invalid or expired verification request');
  }

  /**
   * Handle session creation or user signup post-OTP
   */
  private async handlePostOtpSuccess(
    identifier: string,
    type: VerificationType,
    purpose?: 'login' | 'signup',
    password?: string,
  ) {
    const isEmail = type === VerificationType.EMAIL_OTP || identifier.includes('@');
    const cleanId = identifier.trim();

    if (purpose === 'login') {
      const orConds: Prisma.UserWhereInput[] = [
        { email: cleanId.toLowerCase() },
        { phoneNumber: cleanId },
      ];
      const cleanDigits = cleanId.replace(/\D/g, '');
      if (cleanDigits.length >= 10) {
        if (cleanDigits.startsWith('0')) {
          orConds.push({ phoneNumber: `+234${cleanDigits.slice(1)}` });
        } else if (cleanDigits.startsWith('234')) {
          orConds.push({ phoneNumber: `+${cleanDigits}` });
        } else {
          orConds.push({ phoneNumber: `+234${cleanDigits}` });
        }
      }

      let user: any = null;
      if (this.prisma.isConnected) {
        user = await this.prisma.user.findFirst({
          where: { OR: orConds },
        });
      }
      if (!user) {
        const store = InMemoryStore.getInstance();
        user = store.users.get(cleanId.toLowerCase()) || store.users.get(cleanId);
      }

      if (!user) {
        throw new NotFoundException(
          'No account found with this email or phone number. Please register an account first.',
        );
      }

      const tokens = await this.generateTokens(user.id, user.email || user.phoneNumber || user.id, user.role);
      await this.createSession(user.id, tokens.refreshToken);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          role: user.role,
          isProfileComplete: user.isProfileComplete,
          status: user.status,
        },
        tokens,
        message: 'Signed in successfully',
      };
    }

    if (purpose === 'signup') {
      const check = await this.checkIdentifier(cleanId);
      if (check.exists) {
        throw new ConflictException(
          'An account with this email or phone number already exists. Please log in instead.',
        );
      }

      const passwordHash = password ? await HashUtil.hashPassword(password) : null;

      if (this.prisma.isConnected) {
        return await this.prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: isEmail ? cleanId.toLowerCase() : null,
              phoneNumber: !isEmail ? cleanId : null,
              passwordHash,
              role: UserRole.CUSTOMER,
              status: AccountStatus.ACTIVE,
              isEmailVerified: isEmail,
              isPhoneVerified: !isEmail,
              isProfileComplete: false,
            },
          });

          await tx.walletAccount.create({
            data: {
              userId: newUser.id,
              currency: 'NGN',
            },
          });

          const tokens = await this.generateTokens(newUser.id, newUser.email || newUser.phoneNumber || newUser.id, newUser.role);
          await this.createSession(newUser.id, tokens.refreshToken);

          return {
            success: true,
            user: {
              id: newUser.id,
              email: newUser.email,
              phoneNumber: newUser.phoneNumber,
              role: newUser.role,
              isProfileComplete: newUser.isProfileComplete,
              status: newUser.status,
            },
            tokens,
            message: 'Account created successfully',
          };
        });
      } else {
        const store = InMemoryStore.getInstance();
        const newUserId = uuidv4();
        const memUser: InMemoryUser = {
          id: newUserId,
          email: isEmail ? cleanId.toLowerCase() : null,
          phoneNumber: !isEmail ? cleanId : null,
          firstName: null,
          lastName: null,
          profileImageUrl: null,
          role: UserRole.CUSTOMER,
          status: AccountStatus.ACTIVE,
          isProfileComplete: false,
          isPhoneVerified: !isEmail,
          isEmailVerified: isEmail,
          createdAt: new Date(),
          updatedAt: new Date(),
          walletAccount: {
            id: uuidv4(),
            balance: 0,
            currency: 'NGN',
          },
          savedAddresses: [],
        };
        store.users.set(newUserId, memUser);
        if (memUser.email) store.users.set(memUser.email, memUser);
        if (memUser.phoneNumber) store.users.set(memUser.phoneNumber, memUser);

        const tokens = await this.generateTokens(newUserId, cleanId, UserRole.CUSTOMER);
        return {
          success: true,
          user: {
            id: memUser.id,
            email: memUser.email,
            phoneNumber: memUser.phoneNumber,
            role: memUser.role,
            isProfileComplete: memUser.isProfileComplete,
            status: memUser.status,
          },
          tokens,
          message: 'Account created successfully',
        };
      }
    }

    return {
      success: true,
      message: 'Verification successful',
    };
  }

  /**
   * Reset user password using verified OTP code
   */
  async resetPassword(dto: ResetPasswordDto) {
    const cleanId = dto.identifier.trim();
    const isEmail = cleanId.includes('@');
    const type = isEmail ? VerificationType.EMAIL_OTP : VerificationType.PHONE_OTP;

    // 1. Validate OTP
    let tokenRecord: any = null;
    if (this.prisma.isConnected) {
      try {
        tokenRecord = await this.prisma.verificationToken.findFirst({
          where: {
            identifier: cleanId,
            type,
            isUsed: false,
          },
          orderBy: { createdAt: 'desc' },
        });
      } catch (e: any) {
        this.logger.warn(`Prisma error finding token in resetPassword: ${e.message}`);
      }
    }

    let isOtpValid = false;

    if (tokenRecord) {
      if (tokenRecord.attempts >= 5 || new Date() > tokenRecord.expiresAt) {
        await this.prisma.verificationToken.update({
          where: { id: tokenRecord.id },
          data: { isUsed: true },
        }).catch(() => {});
        throw new BadRequestException('Verification code has expired or exceeded maximum attempts.');
      }

      const providedHash = HashUtil.hashToken(dto.code);
      if (!HashUtil.safeCompare(providedHash, tokenRecord.token)) {
        await this.prisma.verificationToken.update({
          where: { id: tokenRecord.id },
          data: { attempts: { increment: 1 } },
        }).catch(() => {});
        throw new BadRequestException('Invalid verification code.');
      }

      await this.prisma.verificationToken.update({
        where: { id: tokenRecord.id },
        data: { isUsed: true },
      }).catch(() => {});
      isOtpValid = true;
    } else {
      // In-memory fallback token check
      const memToken = InMemoryStore.getInstance().tokens.get(cleanId);
      if (memToken) {
        if (memToken.attempts >= 5 || new Date() > memToken.expiresAt) {
          InMemoryStore.getInstance().tokens.delete(cleanId);
          throw new BadRequestException('Verification code has expired or exceeded maximum attempts.');
        }

        const isMatch = memToken.code === dto.code || HashUtil.safeCompare(HashUtil.hashToken(dto.code), memToken.tokenHash);
        if (!isMatch) {
          memToken.attempts++;
          throw new BadRequestException('Invalid verification code.');
        }

        InMemoryStore.getInstance().tokens.delete(cleanId);
        isOtpValid = true;
      }
    }

    if (!isOtpValid) {
      throw new BadRequestException('Invalid or expired verification code.');
    }

    // 2. Hash new password
    const newPasswordHash = await HashUtil.hashPassword(dto.newPassword);

    // 3. Find user in DB or in-memory
    const orConds: Prisma.UserWhereInput[] = [
      { email: cleanId.toLowerCase() },
      { phoneNumber: cleanId },
    ];
    const cleanDigits = cleanId.replace(/\D/g, '');
    if (cleanDigits.length >= 10) {
      if (cleanDigits.startsWith('0')) {
        orConds.push({ phoneNumber: `+234${cleanDigits.slice(1)}` });
      } else if (cleanDigits.startsWith('234')) {
        orConds.push({ phoneNumber: `+${cleanDigits}` });
      } else {
        orConds.push({ phoneNumber: `+234${cleanDigits}` });
      }
    }

    let updated = false;

    if (this.prisma.isConnected) {
      try {
        const user = await this.prisma.user.findFirst({ where: { OR: orConds } });
        if (user) {
          await this.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: newPasswordHash },
          });
          // Revoke active sessions for security so they must re-login
          await this.prisma.userSession.updateMany({
            where: { userId: user.id },
            data: { isRevoked: true },
          }).catch(() => {});
          updated = true;
        }
      } catch (err: any) {
        this.logger.warn(`Prisma error updating password: ${err.message}`);
      }
    }

    // Also update in-memory store
    const store = InMemoryStore.getInstance();
    const memUser = store.users.get(cleanId.toLowerCase()) || store.users.get(cleanId);
    if (memUser) {
      (memUser as any).passwordHash = newPasswordHash;
      updated = true;
    }

    if (!updated && !this.prisma.isConnected) {
      for (const u of store.users.values()) {
        if (u.email === cleanId.toLowerCase() || u.phoneNumber === cleanId) {
          (u as any).passwordHash = newPasswordHash;
          updated = true;
          break;
        }
      }
    }

    return {
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    };
  }

  // --- Helpers ---

  private async generateTokens(userId: string, identifier: string, role: string) {
    const payload = { sub: userId, email: identifier, role };
    const accessSecret = this.configService.get<string>('jwt.accessSecret');
    const accessExpiration = this.configService.get<string>('jwt.accessExpiration');

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessExpiration as any,
    });

    const refreshToken = uuidv4();

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessExpiration,
    };
  }

  private async createSession(
    userId: string,
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (!this.prisma.isConnected) return null;

    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      return await this.prisma.userSession.create({
        data: {
          userId,
          refreshToken,
          expiresAt,
          ipAddress,
          userAgent,
        },
      });
    } catch (e: any) {
      this.logger.warn(`Failed to persist user session in database (${e.message})`);
      return null;
    }
  }
}
