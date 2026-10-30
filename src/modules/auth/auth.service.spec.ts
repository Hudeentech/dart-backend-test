import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '@/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('AuthService', () => {
  let authService: AuthService;

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    walletAccount: {
      create: jest.fn(),
    },
    riderProfile: {
      create: jest.fn(),
    },
    riderAvailability: {
      create: jest.fn(),
    },
    userSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    verificationToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('mock_jwt_access_token'),
  };

  const mockConfigService = {
    get: jest.fn((key) => {
      if (key === 'jwt.accessSecret') return 'test_access_secret';
      if (key === 'jwt.accessExpiration') return '15m';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  it('should reject customer signup if neither email nor phone is provided', async () => {
    await expect(
      authService.signupCustomer({} as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should register a customer with email and set isProfileComplete to false', async () => {
    mockPrismaService.user.findFirst.mockResolvedValue(null);
    mockPrismaService.user.create.mockResolvedValue({
      id: 'cust-1',
      email: 'customer@dart.ng',
      phoneNumber: null,
      role: UserRole.CUSTOMER,
      isProfileComplete: false,
      status: 'ACTIVE',
    });
    mockPrismaService.walletAccount.create.mockResolvedValue({ id: 'wallet-1' });
    mockPrismaService.userSession.create.mockResolvedValue({ id: 'session-1' });

    const result = await authService.signupCustomer({
      email: 'customer@dart.ng',
      password: 'password123',
    });

    expect(result).toBeDefined();
    expect(result.user.role).toEqual(UserRole.CUSTOMER);
    expect(result.user.isProfileComplete).toBe(false);
    expect(result.tokens.accessToken).toBe('mock_jwt_access_token');
  });

  it('should register a rider with phone and create rider profile with ONLINE status', async () => {
    mockPrismaService.user.findFirst.mockResolvedValue(null);
    mockPrismaService.user.create.mockResolvedValue({
      id: 'rider-1',
      email: null,
      phoneNumber: '+2348098765432',
      role: UserRole.RIDER,
      isProfileComplete: false,
      status: 'ACTIVE',
    });
    mockPrismaService.walletAccount.create.mockResolvedValue({ id: 'wallet-2' });
    mockPrismaService.riderProfile.create.mockResolvedValue({ id: 'rp-1', userId: 'rider-1' });
    mockPrismaService.riderAvailability.create.mockResolvedValue({ id: 'ra-1', status: 'ONLINE' });
    mockPrismaService.userSession.create.mockResolvedValue({ id: 'session-2' });

    const result = await authService.signupRider({
      phoneNumber: '+2348098765432',
      password: 'password123',
    });

    expect(result).toBeDefined();
    expect(result.user.role).toEqual(UserRole.RIDER);
    expect(mockPrismaService.riderProfile.create).toHaveBeenCalled();
    expect(mockPrismaService.riderAvailability.create).toHaveBeenCalled();
  });
});
