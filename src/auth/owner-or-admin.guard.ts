import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OwnerOrAdminGuard implements CanActivate {
    constructor(private prisma: PrismaService) { }
    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const req = ctx.switchToHttp().getRequest();
        const user = req.user as { userId: string; role?: string };
        if (!user) return false;
        if (user.role === 'ADMIN') return true;

        // wallet/:id/statement → id da rota
        const walletId = req.params?.id;
        if (!walletId) return false;

        const wallet = await this.prisma.wallet.findUnique({
            where: { id: walletId },
            include: { customer: true },
        });
        if (!wallet) return false;

        // Relacione User -> Customer se já tiver; provisoriamente, permita se o usuário tem mesmo customerId
        // Aqui, vou assumir que User.id == Customer.id do dono. Ajuste se seu vínculo for outro.
        return wallet.customerId === user.userId;
    }
}
