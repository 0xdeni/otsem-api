import { Controller, Put, Param, Body } from '@nestjs/common';
import { FdbankUserService } from '../services/fdbank-user.service';

@Controller('fdbank/users')
export class FdbankUserController {
    constructor(private readonly userService: FdbankUserService) { }

    @Put(':id/status')
    async updateUserStatus(@Param('id') id: string, @Body() data: any) {
        return await this.userService.updateUserStatus(id, data);
    }

    @Put(':id/permissions')
    async updateUserPermissions(@Param('id') id: string, @Body() data: any) {
        return await this.userService.updateUserPermissions(id, data);
    }
}