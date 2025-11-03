// src/admin-customers/admin-customers.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminCustomersService } from './admin-customers.service';
import { AdminListCustomersDto } from './dto/admin-list-customers.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminCustomersController {
    constructor(private readonly svc: AdminCustomersService) { }

    @Get()
    async list(@Query() dto: AdminListCustomersDto) {
        return this.svc.list(dto);
    }
}
