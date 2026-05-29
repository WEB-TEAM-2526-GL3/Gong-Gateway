import { Body, Controller, Get, Param, Post, Query, Sse } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { fromEvent, map, Observable } from 'rxjs';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import { IncidentEntity } from './entities/incident.entity';
import { IncidentSnapshot, IncidentsService } from './incidents.service';
import type { MessageEvent } from '@nestjs/common';

@Controller('incidents')
export class IncidentsController {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post()
  createIncident(@Body() body: CreateIncidentDto): Promise<IncidentSnapshot> {
    return this.incidentsService.createIncident(body);
  }

  @Get()
  listIncidents(
    @Query() query: ListIncidentsQueryDto,
  ): Promise<IncidentEntity[]> {
    return this.incidentsService.listIncidents(query.status);
  }

  @Get(':id')
  getIncident(@Param('id') id: string): Promise<IncidentSnapshot> {
    return this.incidentsService.getIncidentSnapshot(id);
  }

  @Sse('sse')
  sse(): Observable<MessageEvent> {
    return fromEvent(this.eventEmitter, 'incident.created').pipe(
      map((payload) => {
        console.log({ payload });
        return new MessageEvent('incident-created', {
          data: JSON.stringify(payload),
        });
      }),
    );
  }
}
