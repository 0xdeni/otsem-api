import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import type { Request } from 'express'; // 👈 importante: import type

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
    constructor(private readonly svc: UsersService) { }

    @Roles(Role.ADMIN)
    @Post()
    async create(@Body() dto: CreateUserDto) {
        const user = await this.svc.createByAdmin(dto);
        return { ok: true, data: user };
    }

    @Roles(Role.ADMIN)
    @Get()
    async list(@Query('take') take = '50', @Query('skip') skip = '0') {
        const t = Math.min(Number(take || 50), 200);
        const s = Math.max(Number(skip || 0), 0);
        const { total, items } = await this.svc.list(t, s);
        return { ok: true, total, count: items.length, data: items };
    }

    @Roles(Role.ADMIN)
    @Patch(':id')
    async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
        const updated = await this.svc.updateByAdmin(id, dto);
        return { ok: true, data: updated };
    }

    @Patch(':id/password')
    async changePassword(@Param('id') id: string, @Body() dto: ChangePasswordDto, @Req() req: Request) {
        const user = req.user as { userId: string; role: Role };
        return this.svc.changePassword(user, id, dto.currentPassword, dto.newPassword);
    }
}
