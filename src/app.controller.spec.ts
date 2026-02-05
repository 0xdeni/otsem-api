import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('healthCheck', () => {
    it('should return ok status when database is connected', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await appController.healthCheck();

      expect(result.status).toBe('ok');
      expect(result.database).toBe('connected');
      expect(result.version).toBe('1.0.0');
      expect(result.timestamp).toBeDefined();
      expect(typeof result.uptime).toBe('number');
    });

    it('should return error status when database is disconnected', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(
        new Error('Connection refused'),
      );

      const result = await appController.healthCheck();

      expect(result.status).toBe('error');
      expect(result.database).toBe('disconnected');
    });
  });
});
