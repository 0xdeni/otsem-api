// src/customers/customers.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { StatementsService } from '../statements/statements.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import {
  UpdateCustomerDto,
  AccountStatusDto,
  CustomerTypeDto,
} from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { Request } from 'express';

interface AuthRequest extends Request {
  user?: {
    sub: string;
    email: string;
    role?: Role;
  };
}

class UpdateStatusDto {
  status!: string;
}

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(
    private readonly service: CustomersService,
    private readonly statementsService: StatementsService, // ← injeção direta
  ) { }

  /* ==================== ROTAS PÚBLICAS (CUSTOMER + ADMIN) ==================== */

  // Lista customers (auto-scope por role)
  @Get()
  async list(@Req() req: AuthRequest, @Query() query: ListCustomersDto) {
    return this.service.list(query, req.user);
  }

  // Retorna dados do customer logado
  @Get('me')
  async getMe(@Req() req: AuthRequest) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('Usuário não autenticado.');

    const customer = await this.service.findByUserId(userId);
    if (!customer && req.user?.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Você ainda não possui cadastro de cliente.',
      );
    }

    return customer ?? { message: 'Admin sem customer vinculado' };
  }

  // Buscar customer por ID (valida ownership)
  @Get(':id')
  async get(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.findById(id, req.user);
  }

  // Atualizar customer (valida ownership)
  @Patch(':id')
  async update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.service.update(id, dto, req.user);
  }

  /* ==================== SALDO (integração com Statements) ==================== */

  // Consultar saldo do customer
  @Get(':id/balance')
  async getBalance(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user?.sub!;
    const userRole = req.user?.role;

    const customer = await this.service.findById(id);
    if (!customer) throw new ForbiddenException('Customer não encontrado.');

    // Apenas admin ou dono pode ver saldo
    if (userRole !== Role.ADMIN && customer.userId !== userId) {
      throw new ForbiddenException('Acesso negado.');
    }

    if (!customer.externalClientId) {
      throw new BadRequestException('Customer não possui conta na BRX');
    }

    return this.statementsService.getBalance(customer.externalClientId);
  }

  // Consultar extrato do customer
  @Get(':id/statement')
  async getStatement(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Query()
    query: {
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const userId = req.user?.sub!;
    const userRole = req.user?.role;

    const customer = await this.service.findById(id);
    if (!customer) throw new ForbiddenException('Customer não encontrado.');

    // Apenas admin ou dono pode ver extrato
    if (userRole !== Role.ADMIN && customer.userId !== userId) {
      throw new ForbiddenException('Acesso negado.');
    }

    if (!customer.externalClientId) {
      throw new BadRequestException('Customer não possui conta na BRX');
    }

    return this.statementsService.getStatement(
      customer.externalClientId,
      query.page ?? 1,
      query.limit ?? 50,
      query.startDate,
      query.endDate,
    );
  }

  /* ==================== ROTAS CUSTOMER ==================== */

  // Cadastro self-service (CUSTOMER)
  @Post('pf/self')
  @Roles(Role.CUSTOMER)
  async createPfSelf(@Req() req: AuthRequest, @Body() dto: CreatePersonDto) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('Usuário não autenticado.');

    const existing = await this.service.findByUserId(userId);

    if (existing) {
      return this.service.update(existing.id, {
        type: CustomerTypeDto.PF,
        accountStatus: AccountStatusDto.requested,
        email: dto.person.email,
        phone: dto.person.phone,
        name: dto.person.name,
        socialName: dto.person.socialName,
        cpf: dto.person.cpf,
        birthday: dto.person.birthday,
        genderId: dto.person.genderId,
        address: dto.person.address,
        pixLimits: dto.pixLimits,
      });
    }

    return this.service.createPF(dto, userId, AccountStatusDto.requested);
  }

  // Submeter KYC (CUSTOMER)
  @Post('submit-kyc')
  @Roles(Role.CUSTOMER)
  async submitKyc(@Req() req: AuthRequest) {
    const userId = req.user?.sub!;
    return this.service.submitKycByUser(userId);
  }

  /* ==================== ROTAS ADMIN ==================== */

  // Estatísticas
  @Get('stats')
  @Roles(Role.ADMIN)
  async getStats() {
    return this.service.getStats();
  }

  // Buscar por CPF/CNPJ
  @Get('by-tax/:tax')
  @Roles(Role.ADMIN)
  async getByTax(@Param('tax') tax: string) {
    const id = await this.service.resolveCustomerId(tax);
    if (!id) return null;
    return this.service.findById(id);
  }

  // Criar PF
  @Post('pf')
  @Roles(Role.ADMIN)
  async createPF(@Body() dto: CreatePersonDto) {
    return this.service.createPF(dto);
  }

  // Criar PJ
  @Post('pj')
  @Roles(Role.ADMIN)
  async createPJ(@Body() dto: CreateCompanyDto) {
    return this.service.createPJ(dto);
  }

  // Deletar
  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  /* ==================== KYC (ADMIN) ==================== */

  // Aprovar
  @Patch(':id/approve')
  @Roles(Role.ADMIN)
  async approve(@Param('id') id: string) {
    return this.service.updateStatus(id, AccountStatusDto.approved);
  }

  // Rejeitar
  @Patch(':id/reject')
  @Roles(Role.ADMIN)
  async reject(@Param('id') id: string) {
    return this.service.updateStatus(id, AccountStatusDto.rejected);
  }

  // Revisar
  @Patch(':id/review')
  @Roles(Role.ADMIN)
  async review(@Param('id') id: string) {
    return this.service.updateStatus(id, AccountStatusDto.in_review);
  }

  // Atualizar status genérico
  @Patch(':id/status')
  @Roles(Role.ADMIN)
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    const statusMap: Record<string, AccountStatusDto> = {
      approved: AccountStatusDto.approved,
      rejected: AccountStatusDto.rejected,
      in_review: AccountStatusDto.in_review,
      requested: AccountStatusDto.requested,
      not_requested: AccountStatusDto.not_requested,
    };

    const status = statusMap[dto.status?.toLowerCase()];
    if (!status) {
      throw new BadRequestException('Status inválido');
    }

    return this.service.updateStatus(id, status);
  }
}
