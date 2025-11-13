import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { CreateCustomerDto } from './create-customer.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { AccountStatus } from '@prisma/client'; // usar enum do Prisma

export { AccountStatus }; // opcional: exportar para reuso

export class UpdateCustomerDto extends PartialType(
  OmitType(CreateCustomerDto, ['type', 'cpf', 'cnpj'] as const)
) {
  @ApiPropertyOptional({ enum: AccountStatus })
  @IsOptional()
  @IsEnum(AccountStatus)
  accountStatus?: AccountStatus; // agora é o tipo do Prisma
}