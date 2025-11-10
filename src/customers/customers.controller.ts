// src/modules/customers/customers.controller.ts
import {
    Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
    UnauthorizedException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerDto, AccountStatusDto, CustomerTypeDto } from './dto/update-customer.dto';
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

function coerceStatus(input?: string): AccountStatusDto | null {
    if (!input) return null;
    const s = input.trim().toLowerCase().replace(/\s|-/g, '_');
    const map: Record<string, AccountStatusDto> = {
        approved: AccountStatusDto.approved,
        approve: AccountStatusDto.approved,
        kyc_approve: AccountStatusDto.approved,
        approve_kyc: AccountStatusDto.approved,

        rejected: AccountStatusDto.rejected,
        reject: AccountStatusDto.rejected,
        kyc_reject: AccountStatusDto.rejected,
        reject_kyc: AccountStatusDto.rejected,

        in_review: AccountStatusDto.in_review,
        review: AccountStatusDto.in_review,

        requested: AccountStatusDto.requested,
        not_requested: AccountStatusDto.not_requested,
    };
    return map[s] ?? null;
}

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
    constructor(private readonly service: CustomersService) { }

    // Lista customers (apenas ADMIN pode filtrar todos; CUSTOMER vê apenas o seu)
    @Get()
    async list(@Req() req: AuthRequest, @Query() query: ListCustomersDto) {
        const userRole = req.user?.role;
        const userId = req.user?.sub!;

        if (userRole === Role.ADMIN) {
            return this.service.list(query);
        }

        const customer = await this.service.findByUserId(userId);
        return customer ? [customer] : [];
    }

    // Retorna dados do próprio customer
    @Get('me')
    async getMyCustomer(@Req() req: AuthRequest) {
        const userId = req.user?.sub;
        const userRole = req.user?.role;

        if (!userId) throw new UnauthorizedException('Usuário não autenticado.');

        if (userRole === Role.ADMIN) {
            const customer = await this.service.findByUserId(userId);
            return customer ?? { message: 'Admin não possui customer vinculado' };
        }

        const customer = await this.service.findByUserId(userId);
        if (!customer) {
            throw new ForbiddenException('Você ainda não possui um cadastro de cliente.');
        }
        return customer;
    }

    // Cadastro próprio (self-service)
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

    // Buscar por CPF/CNPJ (apenas ADMIN)
    @Get('by-tax/:tax')
    @Roles(Role.ADMIN)
    async getByTax(@Param('tax') tax: string) {
        const id = await this.service.resolveCustomerId(tax);
        if (!id) return null;
        return this.service.findById(id);
    }

    // Buscar customer por ID
    @Get(':id')
    async get(@Req() req: AuthRequest, @Param('id') id: string) {
        const userId = req.user?.sub!;
        const userRole = req.user?.role;

        const customer = await this.service.findById(id);
        if (!customer) return null;

        if (userRole !== Role.ADMIN && customer.userId !== userId) {
            throw new ForbiddenException('Você não tem permissão para acessar este recurso.');
        }

        return customer;
    }

    // Criar PF via admin
    @Post('pf')
    @Roles(Role.ADMIN)
    async createPF(@Body() dto: CreatePersonDto) {
        return this.service.createPF(dto);
    }

    // Criar PJ via admin
    @Post('pj')
    @Roles(Role.ADMIN)
    async createPJ(@Body() dto: CreateCompanyDto) {
        return this.service.createPJ(dto);
    }

    // Submeter KYC
    @Post('submit-kyc')
    @Roles(Role.CUSTOMER)
    async submitKyc(@Req() req: AuthRequest) {
        const userId = req.user?.sub!;
        return this.service.submitKycByUser(userId);
    }

    // Atualizar customer
    @Patch(':id')
    async update(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
        const userId = req.user?.sub!;
        const userRole = req.user?.role;

        const customer = await this.service.findById(id);
        if (!customer) throw new ForbiddenException('Customer não encontrado.');

        if (userRole !== Role.ADMIN && customer.userId !== userId) {
            throw new ForbiddenException('Você não tem permissão para atualizar este recurso.');
        }

        return this.service.update(id, dto);
    }

    // Deletar customer
    @Delete(':id')
    @Roles(Role.ADMIN)
    async remove(@Param('id') id: string) {
        return this.service.remove(id);
    }

    // ==================== ROTAS KYC (PATCH) ====================
    // Cada alias precisa de método próprio

    @Patch(':id/approve-kyc')
    @Roles(Role.ADMIN)
    async approveKycAlias1(@Param('id') id: string) {
        return this.service.update(id, { accountStatus: AccountStatusDto.approved });
    }

    @Patch(':id/kyc/approve')
    @Roles(Role.ADMIN)
    async approveKycAlias2(@Param('id') id: string) {
        return this.service.update(id, { accountStatus: AccountStatusDto.approved });
    }

    @Patch(':id/approve')
    @Roles(Role.ADMIN)
    async approveKycAlias3(@Param('id') id: string) {
        return this.service.update(id, { accountStatus: AccountStatusDto.approved });
    }

    @Patch(':id/reject-kyc')
    @Roles(Role.ADMIN)
    async rejectKycAlias1(@Param('id') id: string) {
        return this.service.update(id, { accountStatus: AccountStatusDto.rejected });
    }

    @Patch(':id/kyc/reject')
    @Roles(Role.ADMIN)
    async rejectKycAlias2(@Param('id') id: string) {
        return this.service.update(id, { accountStatus: AccountStatusDto.rejected });
    }

    @Patch(':id/reject')
    @Roles(Role.ADMIN)
    async rejectKycAlias3(@Param('id') id: string) {
        return this.service.update(id, { accountStatus: AccountStatusDto.rejected });
    }

    @Patch(':id/kyc/review')
    @Roles(Role.ADMIN)
    async reviewKycAlias1(@Param('id') id: string) {
        return this.service.update(id, { accountStatus: AccountStatusDto.in_review });
    }

    @Patch(':id/review')
    @Roles(Role.ADMIN)
    async reviewKycAlias2(@Param('id') id: string) {
        return this.service.update(id, { accountStatus: AccountStatusDto.in_review });
    }

    @Patch(':id/status')
    @Roles(Role.ADMIN)
    async patchStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
        const status = coerceStatus(dto?.status);
        if (!status) {
            throw new BadRequestException('Status inválido. Use: approved, rejected, in_review, requested, not_requested');
        }
        return this.service.update(id, { accountStatus: status });
    }
}
