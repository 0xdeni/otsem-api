import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsObject } from 'class-validator';

export class DiditWebhookPayloadDto {
  @ApiProperty({ description: 'ID da sessão de verificação' })
  @IsString()
  session_id: string;

  @ApiProperty({ description: 'Status da sessão: Approved, Declined, In Progress' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: 'Objeto com detalhes da decisão' })
  @IsOptional()
  @IsObject()
  decision?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Dados do vendor passados na criação (customerId)' })
  @IsOptional()
  @IsString()
  vendor_data?: string;

  @ApiPropertyOptional({ description: 'Tipo do webhook' })
  @IsOptional()
  @IsString()
  webhook_type?: string;

  @ApiPropertyOptional({ description: 'ID do workflow' })
  @IsOptional()
  @IsString()
  workflow_id?: string;

  @ApiPropertyOptional({ description: 'Timestamp do evento' })
  @IsOptional()
  @IsNumber()
  timestamp?: number;

  @ApiPropertyOptional({ description: 'Data de criação' })
  @IsOptional()
  @IsNumber()
  created_at?: number;
}
