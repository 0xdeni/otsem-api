import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AffiliatesService } from '../affiliates/affiliates.service';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    customer: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    account: {
      create: jest.fn(),
    },
    passwordResetToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwt = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockMail = {
    sendPasswordReset: jest.fn(),
  };

  const mockAffiliates = {
    linkCustomerOnRegistration: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: MailService, useValue: mockMail },
        { provide: AffiliatesService, useValue: mockAffiliates },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('validateUser', () => {
    it('should throw UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.validateUser('test@email.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user has no password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@email.com',
        password: null,
      });

      await expect(
        service.validateUser('test@email.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password does not match', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@email.com',
        password: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateUser('test@email.com', 'wrong'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return user with customerId when credentials are valid', async () => {
      const user = {
        id: 'user-1',
        email: 'test@email.com',
        password: 'hashed',
        role: 'CUSTOMER',
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'customer-1',
      });

      const result = await service.validateUser('test@email.com', 'password');

      expect(result.id).toBe('user-1');
      expect(result.customerId).toBe('customer-1');
    });

    it('should return user with undefined customerId when no customer exists', async () => {
      const user = {
        id: 'user-1',
        email: 'admin@email.com',
        password: 'hashed',
        role: 'ADMIN',
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.customer.findFirst.mockResolvedValue(null);

      const result = await service.validateUser('admin@email.com', 'password');

      expect(result.customerId).toBeUndefined();
    });
  });

  describe('login', () => {
    const validUser = {
      id: 'user-1',
      email: 'test@email.com',
      password: 'hashed',
      role: 'CUSTOMER',
    };

    const fullUser = {
      id: 'user-1',
      email: 'test@email.com',
      phone: null,
      name: 'Test User',
      profileImage: null,
      address: null,
      createdAt: new Date('2024-01-01'),
      kycStatus: 'not_started',
      has2FA: false,
      hasBiometric: false,
      hasPin: false,
      role: 'CUSTOMER',
      spreadValue: null,
      preferredCurrency: 'USD',
      notificationsEnabled: true,
    };

    beforeEach(() => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(validUser)
        .mockResolvedValueOnce(fullUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'customer-1',
      });
      mockJwt.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockPrisma.refreshToken.create.mockResolvedValue({});
    });

    it('should return success with tokens and user data', async () => {
      const result = await service.login('test@email.com', 'password');

      expect(result.success).toBe(true);
      expect(result.data.accessToken).toBe('access-token');
      expect(result.data.refreshToken).toBe('refresh-token');
      expect(result.data.user.email).toBe('test@email.com');
    });

    it('should convert createdAt to timestamp', async () => {
      const result = await service.login('test@email.com', 'password');

      expect(result.data.user.createdAt).toBe(
        new Date('2024-01-01').getTime(),
      );
    });

    it('should store refresh token in database', async () => {
      await service.login('test@email.com', 'password');

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          token: 'refresh-token',
        }),
      });
    });

    it('should sign access token with 15m expiry', async () => {
      await service.login('test@email.com', 'password');

      expect(mockJwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-1',
          email: 'test@email.com',
          role: 'CUSTOMER',
          customerId: 'customer-1',
        }),
        { expiresIn: '15m' },
      );
    });
  });

  describe('register', () => {
    const fullUserResponse = {
      id: 'new-user',
      email: 'new@email.com',
      phone: null,
      name: 'New User',
      profileImage: null,
      address: null,
      createdAt: new Date('2024-01-01'),
      kycStatus: 'not_started',
      has2FA: false,
      hasBiometric: false,
      hasPin: false,
      preferredCurrency: 'USD',
      notificationsEnabled: true,
    };

    function setupSuccessfulRegisterMocks() {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // exists check
        .mockResolvedValueOnce(fullUserResponse); // fullUser fetch
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user',
        email: 'new@email.com',
        role: 'CUSTOMER',
      });
      mockPrisma.customer.create.mockResolvedValue({
        id: 'new-customer',
        kycLevel: 'LEVEL_1',
        accountStatus: 'not_requested',
      });
      mockPrisma.account.create.mockResolvedValue({});
      mockAffiliates.linkCustomerOnRegistration.mockResolvedValue(undefined);
      mockJwt.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockPrisma.refreshToken.create.mockResolvedValue({});
    }

    it('should throw ConflictException when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'existing',
        email: 'existing@email.com',
      });

      await expect(
        service.register({
          email: 'existing@email.com',
          password: 'pass123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should register successfully and return tokens', async () => {
      setupSuccessfulRegisterMocks();

      const result = await service.register({
        email: 'new@email.com',
        password: 'pass123',
        name: 'New User',
      });

      expect(result.success).toBe(true);
      expect(result.data.accessToken).toBe('access-token');
      expect(result.data.refreshToken).toBe('refresh-token');
    });

    it('should create user with CUSTOMER role', async () => {
      setupSuccessfulRegisterMocks();

      await service.register({
        email: 'new@email.com',
        password: 'pass123',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'CUSTOMER',
          }),
        }),
      );
    });

    it('should throw BadRequestException for invalid CPF', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // exists check

      await expect(
        service.register({
          email: 'new@email.com',
          password: 'pass123',
          cpf: '11111111111',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate CPF', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // exists check
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        id: 'existing-customer',
      });

      await expect(
        service.register({
          email: 'new@email.com',
          password: 'pass123',
          cpf: '52998224725', // valid CPF
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should auto-approve LEVEL_1 for valid CPF', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // exists check
        .mockResolvedValueOnce(fullUserResponse); // fullUser fetch
      mockPrisma.customer.findUnique.mockResolvedValueOnce(null); // no duplicate CPF
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user',
        email: 'new@email.com',
        role: 'CUSTOMER',
      });
      mockPrisma.customer.create.mockResolvedValue({
        id: 'new-customer',
        kycLevel: 'LEVEL_1',
        accountStatus: 'approved',
      });
      mockPrisma.account.create.mockResolvedValue({});
      mockAffiliates.linkCustomerOnRegistration.mockResolvedValue(undefined);
      mockJwt.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockPrisma.refreshToken.create.mockResolvedValue({});

      await service.register({
        email: 'new@email.com',
        password: 'pass123',
        cpf: '52998224725',
      });

      expect(mockPrisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kycLevel: 'LEVEL_1',
            accountStatus: 'approved',
            type: 'PF',
          }),
        }),
      );
    });

    it('should link affiliate on registration', async () => {
      setupSuccessfulRegisterMocks();

      await service.register({
        email: 'new@email.com',
        password: 'pass123',
        affiliateCode: 'REF123',
      });

      expect(
        mockAffiliates.linkCustomerOnRegistration,
      ).toHaveBeenCalledWith('new-customer', 'REF123');
    });
  });

  describe('requestPasswordReset', () => {
    it('should return ok: true even if user does not exist (neutral response)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.requestPasswordReset(
        'nonexistent@email.com',
      );

      expect(result.ok).toBe(true);
      expect(mockMail.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('should create password reset token and send email when user exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@email.com',
      });
      mockPrisma.passwordResetToken.create.mockResolvedValue({});
      mockMail.sendPasswordReset.mockResolvedValue(undefined);

      const result = await service.requestPasswordReset('test@email.com');

      expect(result.ok).toBe(true);
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
        }),
      });
      expect(mockMail.sendPasswordReset).toHaveBeenCalledWith(
        'test@email.com',
        expect.stringContaining('reset?token='),
      );
    });
  });

  describe('resetPassword', () => {
    it('should throw BadRequestException for invalid or expired token', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword('invalid-token', 'newPassword'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should hash new password and update user when token is valid', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.resetPassword(
        'valid-token',
        'newPassword',
      );

      expect(result.ok).toBe(true);
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword', 12);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('getAccountDetails', () => {
    it('should throw UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getAccountDetails('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return user details with customer data', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@email.com',
        name: 'Test',
        phone: null,
        profileImage: null,
        address: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        kycStatus: 'not_started',
        has2FA: false,
        hasBiometric: false,
        hasPin: false,
        preferredCurrency: 'USD',
        notificationsEnabled: true,
        role: 'CUSTOMER',
        spreadValue: null,
        passwordChangedAt: null,
        customers: [
          {
            id: 'cust-1',
            type: 'PF',
            name: 'Test Customer',
            email: 'test@email.com',
            phone: null,
            cpf: '12345678901',
            cnpj: null,
            birthday: null,
            companyName: null,
            tradingName: null,
            accountStatus: 'approved',
            kycLevel: 'LEVEL_1',
            mainPixKey: null,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02'),
            address: null,
            account: {
              balance: 100.5,
              pixKey: null,
              pixKeyType: 'RANDOM',
              dailyLimit: 5000,
              monthlyLimit: 20000,
              status: 'active',
            },
          },
        ],
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getAccountDetails('user-1');

      expect(result.id).toBe('user-1');
      expect(result.customer).toBeDefined();
      expect(result.customer!.id).toBe('cust-1');
      expect(result.customer!.account!.balance).toBe(100.5);
    });
  });

  describe('logout', () => {
    it('should revoke the refresh token', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.logout('some-refresh-token');

      expect(result.success).toBe(true);
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token: 'some-refresh-token' },
        data: { revoked: true },
      });
    });
  });
});
