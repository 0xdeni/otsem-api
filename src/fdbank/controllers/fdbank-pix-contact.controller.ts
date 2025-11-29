import { Controller, Get } from '@nestjs/common';
import { FdbankPixContactService } from '../services/fdbank-pix-contact.service';

@Controller('fdbank/pix-contacts')
export class FdbankPixContactController {
    constructor(private readonly pixContactService: FdbankPixContactService) { }

    @Get()
    async listPixContacts() {
        return await this.pixContactService.listPixContacts();
    }
}