import { Injectable, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BrxAuthService } from '../brx/brx-auth.service';
import { AccreditationPersonDto } from './dto/accreditation-person.dto';
import { AccreditationCompanyDto } from './dto/accreditation-company.dto';
import { AccreditationResult } from './dto/common.dto';

type BrxResponse<T = any> = {
    StatusCode: number;
    Title: string;
    Type: string;
    Extensions?: {
        Data?: T;
        Message?: string;
    };
};

@Injectable()
export class AccreditationService {
    private readonly baseUrl = process.env.BRX_BASE_URL ?? 'https://apisbank.brxbank.com.br';

    constructor(
        private readonly http: HttpService,
        private readonly brxAuth: BrxAuthService,
    ) { }

    /* -------------------- PF -------------------- */
    async accreditPerson(dto: AccreditationPersonDto): Promise<AccreditationResult> {
        const token = await this.brxAuth.getAccessToken();
        const url = `${this.baseUrl}/accreditation/accreditations/accreditate/person`;

        const body = {
            Identifier: dto.identifier,
            ProductId: dto.productId,
            Person: {
                Name: dto.name,
                SocialName: dto.socialName ?? '',
                Cpf: dto.cpf,
                Birthday: dto.birthday,
                Phone: dto.phone,
                Email: dto.email,
                GenderId: dto.genderId ?? undefined,
                Address: {
                    ZipCode: dto.address.zipCode,
                    Street: dto.address.street,
                    Number: dto.address.number ?? '',
                    Complement: dto.address.complement ?? '',
                    Neighborhood: dto.address.neighborhood,
                    CityIbgeCode: dto.address.cityIbgeCode,
                },
            },
            PixLimits: {
                SingleTransfer: dto.pixLimits.singleTransfer,
                Daytime: dto.pixLimits.daytime,
                Nighttime: dto.pixLimits.nighttime,
                Monthly: dto.pixLimits.monthly,
                ServiceId: dto.pixLimits.serviceId,
            },
        };

        const { data } = await firstValueFrom(
            this.http.post<BrxResponse>(url, body, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            }),
        );

        const d = data?.Extensions?.Data;
        if (!d) throw new BadRequestException('Resposta inválida ao credenciar PF.');

        return {
            accreditationId: d.AccreditationId,
            clientId: d.ClientId,
            accreditationStatus: d.AccreditationStatus,
            accreditationStatusId: d.AccreditationStatusId,
            product: d.Product,
            productId: d.ProductId,
            person: d.Person && {
                name: d.Person.Name,
                socialName: d.Person.SocialName ?? null,
                cpf: d.Person.Cpf,
                birthday: d.Person.Birthday,
                phone: d.Person.Phone,
                email: d.Person.Email,
                genderId: d.Person.GenderId ?? null,
                address: {
                    zipCode: d.Person.Address.ZipCode,
                    street: d.Person.Address.Street,
                    number: d.Person.Address.Number ?? null,
                    complement: d.Person.Address.Complement ?? null,
                    neighborhood: d.Person.Address.Neighborhood,
                    cityIbgeCode: d.Person.Address.CityIbgeCode,
                },
            },
            pixLimits: d.PixLimits && {
                singleTransfer: d.PixLimits.SingleTransfer,
                daytime: d.PixLimits.Daytime ?? d.PixLimits.DayTime,   // doc alterna Daytime/DayTime
                nighttime: d.PixLimits.Nighttime ?? d.PixLimits.NightTime,
                monthly: d.PixLimits.Monthly,
            },
            message: data.Extensions?.Message,
        };
    }

    /* -------------------- PJ -------------------- */
    async accreditCompany(dto: AccreditationCompanyDto): Promise<AccreditationResult> {
        const token = await this.brxAuth.getAccessToken();
        const url = `${this.baseUrl}/accreditation/accreditations/accreditate/company`;

        const body = {
            Identifier: dto.identifier,
            ProductId: dto.productId,
            Company: {
                LegalName: dto.legalName,
                TradeName: dto.tradeName,
                Cnpj: dto.cnpj,
                Phone: dto.phone,
                Email: dto.email,
                Address: {
                    ZipCode: dto.address.zipCode,
                    Street: dto.address.street,
                    Number: dto.address.number ?? '',
                    Complement: dto.address.complement ?? '',
                    Neighborhood: dto.address.neighborhood,
                    CityIbgeCode: dto.address.cityIbgeCode,
                },
                OwnershipStructure: dto.ownershipStructure.map((o) => ({
                    Name: o.name,
                    Cpf: o.cpf,
                    Birthday: o.birthday,
                    IsAdministrator: o.isAdministrator,
                })),
            },
            PixLimits: {
                SingleTransfer: dto.pixLimits.singleTransfer,
                Daytime: dto.pixLimits.daytime,
                Nighttime: dto.pixLimits.nighttime,
                Monthly: dto.pixLimits.monthly,
                ServiceId: dto.pixLimits.serviceId,
            },
        };

        const { data } = await firstValueFrom(
            this.http.post<BrxResponse>(url, body, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            }),
        );

        const d = data?.Extensions?.Data;
        if (!d) throw new BadRequestException('Resposta inválida ao credenciar PJ.');

        return {
            accreditationId: d.AccreditationId,
            clientId: d.ClientId,
            accreditationStatus: d.AccreditationStatus,
            accreditationStatusId: d.AccreditationStatusId,
            product: d.Product,
            productId: d.ProductId,
            company: d.Company && {
                legalName: d.Company.LegalName,
                tradeName: d.Company.TradeName,
                cnpj: d.Company.Cnpj,
                phone: d.Company.Phone,
                email: d.Company.Email,
                address: {
                    zipCode: d.Company.Address.ZipCode,
                    street: d.Company.Address.Street,
                    number: d.Company.Address.Number ?? null,
                    complement: d.Company.Address.Complement ?? null,
                    neighborhood: d.Company.Address.Neighborhood,
                    cityIbgeCode: d.Company.Address.CityIbgeCode,
                },
                ownershipStructure: (d.Company.OwnershipStructure ?? []).map((o: any) => ({
                    name: o.Name,
                    cpf: o.Cpf,
                    birthday: o.Birthday,
                    isAdministrator: Boolean(o.IsAdministrator),
                })),
            },
            pixLimits: d.PixLimits && {
                singleTransfer: d.PixLimits.SingleTransfer,
                daytime: d.PixLimits.Daytime ?? d.PixLimits.DayTime,
                nighttime: d.PixLimits.Nighttime ?? d.PixLimits.NightTime,
                monthly: d.PixLimits.Monthly,
            },
            message: data.Extensions?.Message,
        };
    }
}
