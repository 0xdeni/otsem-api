import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum EmailTemplateType {
  KYC_REMINDER = 'kyc_reminder',
  ACCOUNT_BLOCKED = 'account_blocked',
  ACCOUNT_UNBLOCKED = 'account_unblocked',
  WELCOME = 'welcome',
}

export class SendEmailDto {
  @ApiProperty({ description: 'Assunto do email', example: 'Complete sua verificação de identidade' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ description: 'Corpo do email (texto)', example: 'Olá João,\n\nNotamos que você ainda não completou...' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ 
    description: 'Identificador do template usado', 
    enum: EmailTemplateType,
    example: 'kyc_reminder' 
  })
  @IsOptional()
  @IsEnum(EmailTemplateType)
  template?: EmailTemplateType;
}
