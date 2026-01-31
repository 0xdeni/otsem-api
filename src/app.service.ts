import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  async healthCheck() {
    const timestamp = new Date().toISOString();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000); // uptime in seconds
    const version = '1.0.0';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        timestamp,
        uptime,
        version,
        database: 'connected'
      };
    } catch {
      return {
        status: 'error',
        timestamp,
        uptime,
        version,
        database: 'disconnected'
      };
    }
  }
}
