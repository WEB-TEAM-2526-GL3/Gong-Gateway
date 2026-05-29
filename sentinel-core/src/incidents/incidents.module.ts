import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentRoomGateway } from './incident-room.gateway';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { IncidentEntity } from './entities/incident.entity';
import { IncidentLogEntity } from './entities/incident-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IncidentEntity, IncidentLogEntity])],
  controllers: [IncidentsController],
  providers: [IncidentsService, IncidentRoomGateway],
  exports: [IncidentsService],
})
export class IncidentsModule {}
