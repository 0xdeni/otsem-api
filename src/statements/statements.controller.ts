// src/statements/statements.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { StatementsService } from './statements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { IsOptional, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

interface AuthRequest extends Request {
  user?: {
    sub: string;
    email: string;
    role?: Role;
  };
}

class GetStatementDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

@Controller('statements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatementsController {
  constructor(
    private readonly service: StatementsService,
    private readonly prisma: PrismaService,
  ) {}

  // Validar se o user tem acesso ao accountHolderId
  private async validateAccess(
    accountHolderId: string,
    user: any,
  ): Promise<void> {
    if (user.role === Role.ADMIN) return; // Admin pode tudo

    // Buscar customer pelo externalClientId
    const customer = await this.prisma.customer.findFirst({
      where: { externalClientId: accountHolderId },
    });

    if (!customer || customer.userId !== user.sub) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar este recurso.',
      );
    }
  }

  // Consultar saldo
  @Get('account-holders/:accountHolderId/balance')
  @Roles(Role.ADMIN, Role.CUSTOMER)
  async getBalance(
    @Req() req: AuthRequest,
    @Param('accountHolderId') accountHolderId: string,
  ) {
    await this.validateAccess(accountHolderId, req.user);
    return this.service.getBalance(accountHolderId);
  }

  // Consultar extrato
  @Get('account-holders/:accountHolderId')
  @Roles(Role.ADMIN, Role.CUSTOMER)
  async getStatement(
    @Req() req: AuthRequest,
    @Param('accountHolderId') accountHolderId: string,
    @Query() query: GetStatementDto,
  ) {
    await this.validateAccess(accountHolderId, req.user);
    return this.service.getStatement(
      accountHolderId,
      query.page ?? 1,
      query.limit ?? 50,
      query.startDate,
      query.endDate,
    );
  }
}
