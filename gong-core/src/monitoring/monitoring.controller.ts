import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMonitoringRuleDto } from './dto/create-monitoring-rule.dto';
import { UpdateMonitoringRuleDto } from './dto/update-monitoring-rule.dto';
import { MonitoringService } from './monitoring.service';

@UseGuards(JwtAuthGuard)
@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  // ─── Rules CRUD ───────────────────────────────────────────────────

  @Post('rules')
  createRule(@Body() dto: CreateMonitoringRuleDto) {
    return this.monitoringService.createRule(dto);
  }

  @Get('rules')
  listRules() {
    return this.monitoringService.listRules();
  }

  @Get('rules/:id')
  findRule(@Param('id') id: string) {
    return this.monitoringService.findRule(id);
  }

  @Patch('rules/:id')
  updateRule(@Param('id') id: string, @Body() dto: UpdateMonitoringRuleDto) {
    return this.monitoringService.updateRule(id, dto);
  }

  @Delete('rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRule(@Param('id') id: string) {
    return this.monitoringService.deleteRule(id);
  }

  // ─── Manual check & live status ───────────────────────────────────

  /**
   * Immediately run a metric check across all active rules.
   * Returns the full report with per-rule results.
   */
  @Post('check')
  @HttpCode(HttpStatus.OK)
  runCheck() {
    return this.monitoringService.runManualCheck();
  }

  /**
   * Return the cached result of the last scheduled or manual check.
   * 404 if no check has run yet since boot.
   */
  @Get('status')
  getStatus() {
    const report = this.monitoringService.getLastReport();
    if (!report) {
      throw new NotFoundException(
        'No monitoring check has run yet. POST /monitoring/check to trigger one.',
      );
    }
    return report;
  }
}
