import { Body, Controller, Post } from '@nestjs/common';
import { AccreditationService } from './accreditation.service';
import { AccreditationPersonDto } from './dto/accreditation-person.dto';
import { AccreditationCompanyDto } from './dto/accreditation-company.dto';

@Controller('accreditation')
export class AccreditationController {
    constructor(private readonly service: AccreditationService) { }

    @Post('person')
    accreditPerson(@Body() dto: AccreditationPersonDto) {
        return this.service.accreditPerson(dto);
    }

    @Post('company')
    accreditCompany(@Body() dto: AccreditationCompanyDto) {
        return this.service.accreditCompany(dto);
    }
}
