// src/common/dto/pix-limits.dto.ts
import { IsInt, Min } from 'class-validator';

export class PixLimitsDto {
  @IsInt()
  @Min(0)
  singleTransfer!: number;

  @IsInt()
  @Min(0)
  daytime!: number;

  @IsInt()
  @Min(0)
  nighttime!: number;

  @IsInt()
  @Min(0)
  monthly!: number;

  @IsInt()
  serviceId!: number;
}
