import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IncidentEntity } from './incident.entity';

@Entity('incident_logs')
export class IncidentLogEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ManyToOne(() => IncidentEntity, (incident) => incident.logs, {
    onDelete: 'CASCADE',
  })
  incident: IncidentEntity;

  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId: string;

  @Column({ name: 'admin_id', type: 'varchar', nullable: true })
  adminId: string | null;

  @Column({ type: 'varchar' })
  action: string;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
