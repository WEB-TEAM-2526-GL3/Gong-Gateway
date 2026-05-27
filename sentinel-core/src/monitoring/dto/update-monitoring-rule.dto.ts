import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateMonitoringRuleDto } from './create-monitoring-rule.dto';

export class UpdateMonitoringRuleDto extends PartialType(CreateMonitoringRuleDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
