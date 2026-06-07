import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { CreateKongRouteDto } from './route.dto.js';

export class CreateKongServiceDto {
  @IsString()
  name!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateKongRouteDto)
  route?: CreateKongRouteDto;
}

export class UpdateKongServiceDto extends PartialType(CreateKongServiceDto) {
  @IsString()
  id!: string;
}

export class AddServiceApiKeyDto {
  @IsString()
  apiKey!: string;
}
