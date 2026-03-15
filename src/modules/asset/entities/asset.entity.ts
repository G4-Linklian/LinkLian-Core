import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

export enum AssetStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('theme_setting')
export class AssetEntity {
  @PrimaryGeneratedColumn()
  theme_id: number;

  @Column({ name: 'theme_name', type: 'text' })
  theme_name: string;

  @Column({ name: 'theme_url', type: 'text' })
  theme_url: string;

  @Column({ name: 'start_date', type: 'date' })
  start_date?: Date;

  @Column({ name: 'end_date', type: 'date' })
  end_date?: Date;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  is_default: boolean;

  @Column({ name: 'status', default: 'pending' })
  status?: string;

  @Column({ name: 'flag_valid', type: 'boolean', default: true })
  flag_valid: boolean;
}