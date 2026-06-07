import { PartialType } from '@nestjs/mapped-types';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateKongRouteDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  paths!: string[];

  @IsOptional()
  @IsBoolean()
  stripPath?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  methods?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hosts?: string[];
}

export class UpdateKongRouteDto extends PartialType(CreateKongRouteDto) {
  @IsString()
  id!: string;
}
