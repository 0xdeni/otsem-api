import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService, EmailTemplate } from '../mail/mail.service';

interface ListUsersParams {
  page: number;
  limit: number;
  search?: string;
  kycStatus?: string;
  accountStatus?: string;
}

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async listUsers(params: ListUsersParams) {
    const { page, limit, search, kycStatus, accountStatus } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { cpf: { contains: search } },
        { cnpj: { contains: search } },
      ];
    }

    if (kycStatus) {
      const statusMap: Record<string, string[]> = {
        'APPROVED': ['approved'],
        'PENDING': ['requested', 'in_review'],
        'REJECTED': ['rejected'],
        'NOT_STARTED': ['not_requested'],
      };
      const mappedStatuses = statusMap[kycStatus];
      if (mappedStatuses) {
        where.accountStatus = { in: mappedStatuses };
      }
    }

    if (accountStatus) {
      if (accountStatus === 'ACTIVE') {
        where.accountStatus = 'approved';
      } else if (accountStatus === 'BLOCKED') {
        where.accountStatus = 'suspended';
      }
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          account: { select: { balance: true } },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: customers.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        cpfCnpj: c.cpf || c.cnpj || '',
        phone: c.phone || '',
        role: 'CUSTOMER',
        kycStatus: this.mapKycStatus(c.accountStatus),
        accountStatus: this.mapAccountStatus(c.accountStatus),
        balanceBRL: c.account ? Number(c.account.balance) : 0,
        createdAt: c.createdAt,
        lastLoginAt: null,
      })),
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async getUserDetails(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        account: { select: { balance: true } },
        address: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      cpfCnpj: customer.cpf || customer.cnpj || '',
      phone: customer.phone || '',
      role: 'CUSTOMER',
      kycStatus: this.mapKycStatus(customer.accountStatus),
      accountStatus: this.mapAccountStatus(customer.accountStatus),
      balanceBRL: customer.account ? Number(customer.account.balance) : 0,
      address: customer.address ? {
        street: customer.address.street,
        number: customer.address.number,
        complement: customer.address.complement,
        neighborhood: customer.address.neighborhood,
        city: customer.address.city,
        state: customer.address.state,
        zipCode: customer.address.zipCode,
      } : null,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      lastLoginAt: null,
      kycDetails: {
        submittedAt: customer.accountStatus !== 'not_requested' ? customer.updatedAt : null,
        reviewedAt: ['approved', 'rejected'].includes(customer.accountStatus) ? customer.updatedAt : null,
        reviewedBy: null,
        rejectReason: null,
        documentType: null,
      },
    };
  }

  async getUserTransactions(customerId: string, limit: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { account: { select: { id: true } } },
    });

    if (!customer) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (!customer.account) {
      return { data: [], total: 0, page: 1, limit };
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { accountId: customer.account.id },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          amount: true,
          status: true,
          description: true,
          createdAt: true,
        },
      }),
      this.prisma.transaction.count({
        where: { accountId: customer.account.id },
      }),
    ]);

    return {
      data: transactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: Number(tx.amount),
        status: tx.status,
        description: tx.description || this.getDefaultDescription(tx.type),
        createdAt: tx.createdAt,
      })),
      total,
      page: 1,
      limit,
    };
  }

  async blockUser(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.prisma.customer.update({
      where: { id },
      data: { accountStatus: 'suspended' },
    });

    this.logger.log(`Usuário ${id} bloqueado`);
    return { success: true, message: 'Usuário bloqueado com sucesso' };
  }

  async unblockUser(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.prisma.customer.update({
      where: { id },
      data: { accountStatus: 'approved' },
    });

    this.logger.log(`Usuário ${id} desbloqueado`);
    return { success: true, message: 'Usuário desbloqueado com sucesso' };
  }

  async sendEmail(userId: string, subject: string, message: string, template?: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: userId } });
    if (!customer) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const result = await this.mailService.sendEmail({
      to: customer.email,
      subject,
      message,
      template: template as EmailTemplate,
      recipientName: customer.name,
    });

    if (!result.success) {
      throw new BadRequestException(`Falha ao enviar email: ${result.error}`);
    }

    this.logger.log(`Email "${subject}" enviado para ${customer.email} (template: ${template || 'custom'})`);
    
    return { 
      success: true, 
      message: 'Email enviado com sucesso',
      messageId: result.messageId,
      sentTo: customer.email,
      template: template || null,
    };
  }

  private mapKycStatus(status: string): string {
    const map: Record<string, string> = {
      'not_requested': 'NOT_STARTED',
      'requested': 'PENDING',
      'in_review': 'PENDING',
      'approved': 'APPROVED',
      'rejected': 'REJECTED',
      'suspended': 'APPROVED',
    };
    return map[status] || 'NOT_STARTED';
  }

  private mapAccountStatus(status: string): string {
    const map: Record<string, string> = {
      'not_requested': 'ACTIVE',
      'requested': 'ACTIVE',
      'in_review': 'ACTIVE',
      'approved': 'ACTIVE',
      'rejected': 'ACTIVE',
      'suspended': 'BLOCKED',
    };
    return map[status] || 'ACTIVE';
  }

  private getDefaultDescription(type: string): string {
    const descriptions: Record<string, string> = {
      PIX_IN: 'Depósito via PIX',
      PIX_OUT: 'Saque via PIX',
      CONVERSION: 'Conversão BRL → USDT',
      TRANSFER: 'Transferência',
      PAYOUT: 'Pagamento USDT',
    };
    return descriptions[type] || type;
  }

  async deleteUser(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true, name: true, email: true },
    });

    if (!customer) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.prisma.customer.delete({ where: { id } });

    this.logger.log(`Usuário ${customer.email} (${id}) deletado com todos os dados relacionados`);
    return {
      success: true,
      message: 'Usuário deletado com sucesso',
      deleted: { id: customer.id, name: customer.name, email: customer.email },
    };
  }

  async deleteUsers(ids: string[]) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('Nenhum ID fornecido');
    }

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true },
    });

    if (customers.length === 0) {
      throw new NotFoundException('Nenhum usuário encontrado com os IDs fornecidos');
    }

    await this.prisma.customer.deleteMany({ where: { id: { in: ids } } });

    this.logger.log(`${customers.length} usuários deletados: ${customers.map(c => c.email).join(', ')}`);
    return {
      success: true,
      message: `${customers.length} usuário(s) deletado(s) com sucesso`,
      deletedCount: customers.length,
      deleted: customers.map(c => ({ id: c.id, name: c.name, email: c.email })),
    };
  }

  async deleteAllUsers() {
    const count = await this.prisma.customer.count();

    if (count === 0) {
      return { success: true, message: 'Nenhum usuário para deletar', deletedCount: 0 };
    }

    await this.prisma.customer.deleteMany();

    this.logger.log(`${count} usuários deletados com todos os dados relacionados`);
    return {
      success: true,
      message: `${count} usuário(s) deletado(s) com sucesso`,
      deletedCount: count,
    };
  }

  async updateSpread(customerId: string, spreadPercent: number) {
    if (spreadPercent < 0 || spreadPercent > 100) {
      throw new BadRequestException('Spread deve estar entre 0 e 100%');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { userId: true, name: true, email: true },
    });

    if (!customer || !customer.userId) {
      throw new NotFoundException('Cliente não encontrado ou sem usuário vinculado');
    }

    const spreadValue = 1 - (spreadPercent / 100);

    await this.prisma.user.update({
      where: { id: customer.userId },
      data: { spreadValue },
    });

    this.logger.log(`Spread atualizado para ${customer.email}: ${spreadPercent}% (spreadValue=${spreadValue})`);

    return {
      success: true,
      message: `Spread atualizado para ${spreadPercent}%`,
      customer: { id: customerId, name: customer.name, email: customer.email },
      spreadPercent,
      spreadValue,
    };
  }
}
