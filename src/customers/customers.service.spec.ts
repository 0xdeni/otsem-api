import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('CustomersService', () => {
  let service: CustomersService;

  const mockPrisma = {
    customer: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    account: {
      create: jest.fn(),
    },
    user: {
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  describe('findById', () => {
    it('should throw NotFoundException when customer not found', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return customer response when found', async () => {
      const customer = {
        id: 'cust-1',
        userId: 'user-1',
        type: 'PF',
        name: 'Test Customer',
        email: 'test@email.com',
        username: 'testuser',
        phone: null,
        cpf: '12345678901',
        cnpj: null,
        accountStatus: 'approved',
        externalClientId: null,
        externalAccredId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        birthday: null,
      };
      mockPrisma.customer.findUnique.mockResolvedValue(customer);

      const result = await service.findById('cust-1');

      expect(result.id).toBe('cust-1');
      expect(result.name).toBe('Test Customer');
      expect(result.statusLabel).toBe('Aprovado');
    });
  });

  describe('findByUserId', () => {
    it('should throw NotFoundException when no customer for user', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.findByUserId('user-unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return customer for the given userId', async () => {
      const customer = {
        id: 'cust-1',
        userId: 'user-1',
        type: 'PF',
        name: 'Test',
        email: 'test@test.com',
        username: null,
        phone: null,
        cpf: null,
        cnpj: null,
        accountStatus: 'not_requested',
        externalClientId: null,
        externalAccredId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        birthday: null,
      };
      mockPrisma.customer.findFirst.mockResolvedValue(customer);

      const result = await service.findByUserId('user-1');

      expect(result.userId).toBe('user-1');
    });
  });

  describe('findByUsername', () => {
    it('should throw NotFoundException when username not found', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      await expect(
        service.findByUsername('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return customer when username found', async () => {
      const customer = { id: 'cust-1', username: 'testuser' };
      mockPrisma.customer.findUnique.mockResolvedValue(customer);

      const result = await service.findByUsername('testuser');

      expect(result.username).toBe('testuser');
    });
  });

  describe('create', () => {
    const createDto = {
      type: 'PF' as any,
      name: 'New Customer',
      email: 'new@email.com',
      cpf: '12345678901',
    };

    it('should throw ConflictException when email is duplicate', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        email: 'new@email.com',
      });

      await expect(service.create('user-1', createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when CPF is duplicate', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        cpf: '12345678901',
        email: 'other@email.com',
      });

      await expect(service.create('user-1', createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create customer and account successfully', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      const createdCustomer = {
        id: 'cust-new',
        userId: 'user-1',
        type: 'PF',
        name: 'New Customer',
        email: 'new@email.com',
        username: null,
        phone: null,
        cpf: '12345678901',
        cnpj: null,
        accountStatus: 'not_requested',
        externalClientId: null,
        externalAccredId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        birthday: null,
      };
      mockPrisma.customer.create.mockResolvedValue(createdCustomer);
      mockPrisma.account.create.mockResolvedValue({});

      const result = await service.create('user-1', createDto);

      expect(result.id).toBe('cust-new');
      expect(mockPrisma.account.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId: 'cust-new',
          balance: 0,
          status: 'active',
        }),
      });
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when customer does not exist', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Updated' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update customer data', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        id: 'cust-1',
        name: 'Old Name',
        accountStatus: 'approved',
      });
      const updated = {
        id: 'cust-1',
        userId: 'user-1',
        type: 'PF',
        name: 'Updated Name',
        email: 'test@test.com',
        username: null,
        phone: null,
        cpf: null,
        cnpj: null,
        accountStatus: 'approved',
        externalClientId: null,
        externalAccredId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        birthday: null,
      };
      mockPrisma.customer.update.mockResolvedValue(updated);

      const result = await service.update('cust-1', {
        name: 'Updated Name',
      } as any);

      expect(result.name).toBe('Updated Name');
    });
  });

  describe('delete', () => {
    it('should delete customer and associated user', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        id: 'cust-1',
        userId: 'user-1',
        name: 'Test',
        accountStatus: 'approved',
      });
      mockPrisma.customer.delete.mockResolvedValue({});
      mockPrisma.user.delete.mockResolvedValue({});

      const result = await service.delete('cust-1');

      expect(result.deleted).toBe(true);
      expect(mockPrisma.customer.delete).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
      });
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const customers = [
        {
          id: 'c1',
          name: 'A',
          accountStatus: 'approved',
          userId: 'u1',
          type: 'PF',
          email: 'a@a.com',
          username: null,
          phone: null,
          cpf: null,
          cnpj: null,
          externalClientId: null,
          externalAccredId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          birthday: null,
        },
      ];
      mockPrisma.customer.findMany.mockResolvedValue(customers);
      mockPrisma.customer.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should apply search filter across multiple fields', async () => {
      mockPrisma.customer.findMany.mockResolvedValue([]);
      mockPrisma.customer.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, search: 'João' });

      expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: 'João', mode: 'insensitive' } },
              { email: { contains: 'João', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });
  });

  describe('mapStatus', () => {
    it('should map known statuses to Portuguese labels', async () => {
      const statusCustomer = (status: string) => ({
        id: '1',
        userId: 'u1',
        type: 'PF',
        name: 'T',
        email: 'e@e.com',
        username: null,
        phone: null,
        cpf: null,
        cnpj: null,
        accountStatus: status,
        externalClientId: null,
        externalAccredId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        birthday: null,
      });

      mockPrisma.customer.findUnique.mockResolvedValue(
        statusCustomer('not_requested'),
      );
      let result = await service.findById('1');
      expect(result.statusLabel).toBe('Não solicitado');

      mockPrisma.customer.findUnique.mockResolvedValue(
        statusCustomer('approved'),
      );
      result = await service.findById('1');
      expect(result.statusLabel).toBe('Aprovado');

      mockPrisma.customer.findUnique.mockResolvedValue(
        statusCustomer('rejected'),
      );
      result = await service.findById('1');
      expect(result.statusLabel).toBe('Rejeitado');
    });
  });

  describe('eraseAll', () => {
    it('should delete all customers and non-admin users', async () => {
      mockPrisma.customer.count.mockResolvedValue(5);
      mockPrisma.customer.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.user.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.eraseAll();

      expect(result.deletedCustomers).toBe(5);
      expect(result.deletedUsers).toBe(5);
      expect(mockPrisma.user.deleteMany).toHaveBeenCalledWith({
        where: { role: { not: 'ADMIN' } },
      });
    });
  });
});
