import { Controller, Get, Res } from '@nestjs/common';
import express from 'express';
import { join } from 'node:path';

@Controller()
export class FrontendController {
  @Get(['/', 'login', 'register', 'dashboard'])
  serveFrontend(@Res() response: express.Response) {
    return response.sendFile(join(process.cwd(), 'public', 'index.html'));
  }
}
