import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DiditWebhookPayloadDto {
  @ApiProperty({ description: 'ID da sessão de verificação' })
  session_id: string;

  @ApiProperty({ description: 'Status da sessão' })
  status: string;

  @ApiPropertyOptional({ description: 'Decisão da verificação: Approved, Declined, Review' })
  decision?: string;

  @ApiPropertyOptional({ description: 'Dados do vendor passados na criação' })
  vendor_data?: string;

  @ApiPropertyOptional()
  document_data?: Record<string, any>;

  @ApiPropertyOptional()
  face_data?: Record<string, any>;

  @ApiPropertyOptional()
  created_at?: string;

  @ApiPropertyOptional()
  updated_at?: string;
}
