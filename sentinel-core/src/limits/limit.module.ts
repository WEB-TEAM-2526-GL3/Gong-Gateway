import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestLimit } from './request-limit.entity';
import { TokenLimit } from './token-limit.entity';
import { RequestLimitRepository } from './request-limit.repository';
import { TokenLimitRepository } from './token-limit.repository';

@Module({
  imports: [TypeOrmModule.forFeature([RequestLimit, TokenLimit])],
  providers: [RequestLimitRepository, TokenLimitRepository],
  exports: [RequestLimitRepository, TokenLimitRepository],
})
export class LimitModule {}