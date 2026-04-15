import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('admin_report')
export class AdminReport {
  @PrimaryGeneratedColumn('increment')
  admin_report_id!: number;

  @Column({ name: 'inst_id', type: 'int' })
  inst_id!: number;

  @Column({ name: 'title', type: 'text' })
  title!: string;

  @Column({ name: 'detail', type: 'text' })
  detail!: string;

  @Column({ name: 'report_file', type: 'jsonb', nullable: true })
  report_file?: Record<string, unknown> | null;

  @Column({ name: 'flag_valid', default: true })
  flag_valid!: boolean;

  @Column({ name: 'report_date', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  report_date!: Date;

  @Column({ name: 'mark_resolved', default: false })
  mark_resolved!: boolean;
}
