import { PartialType } from '@nestjs/mapped-types';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateKongConsumerDto {
  @IsString()
  username!: string;

  @IsOptional()
  @IsString()
  customId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateKongConsumerDto extends PartialType(CreateKongConsumerDto) {
  @IsString()
  id!: string;
}
