import { PartialType } from '@nestjs/mapped-types';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateKongPluginDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateKongPluginDto extends PartialType(CreateKongPluginDto) {}
