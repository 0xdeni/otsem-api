import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminWalletsService {
  constructor(private prisma: PrismaService) {}

  async listWallets(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [wallets, total] = await Promise.all([
      this.prisma.wallet.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.wallet.count(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: wallets.map((w) => ({
        id: w.id,
        customerId: w.customerId,
        customerName: w.customer?.name || null,
        customerEmail: w.customer?.email || null,
        address: w.externalAddress,
        network: w.network,
        label: w.label,
        okxWhitelisted: w.okxWhitelisted,
        isActive: (w as any).isActive ?? true,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async updateOkxWhitelist(walletId: string, whitelisted: boolean) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada');
    }

    await this.prisma.wallet.update({
      where: { id: walletId },
      data: { okxWhitelisted: whitelisted },
    });

    return { success: true };
  }

  async toggleActive(walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada');
    }

    const currentActive = (wallet as any).isActive ?? true;
    await this.prisma.wallet.update({
      where: { id: walletId },
      data: { isActive: !currentActive } as any,
    });

    return { success: true };
  }
}
