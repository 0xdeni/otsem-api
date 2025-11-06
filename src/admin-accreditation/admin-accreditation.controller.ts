import { Controller, Get, Post, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { AdminAccreditationService } from './admin-accreditation.service';
import { AdminAccreditatePfDto } from './dto/admin-accreditate-pf.dto';
import { AdminAccreditatePjDto } from './dto/admin-accreditate-pj.dto';

@Controller('admin/accreditation')
export class AdminAccreditationController {
    constructor(private readonly service: AdminAccreditationService) { }

    @Get()
    list() {
        return this.service.list();
    }

    @Post('pf/:id')
    accreditPF(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminAccreditatePfDto) {
        return this.service.accreditPerson(id, dto);
    }

    @Post('pj/:id')
    accreditPJ(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminAccreditatePjDto) {
        return this.service.accreditCompany(id, dto);
    }
}
