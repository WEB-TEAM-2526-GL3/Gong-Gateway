import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('dashboard')
  getDashboard(@Res() res: Response) {
    const dashboardPath = path.join(
      process.cwd(),
      'public',
      'dashboard.html',
    );

    try {
      const html = fs.readFileSync(dashboardPath, 'utf-8');
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      res.status(404).json({
        error: 'Dashboard not found',
        message: `Could not find dashboard at ${dashboardPath}`,
      });
    }
  }
}
