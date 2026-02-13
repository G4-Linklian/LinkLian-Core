// section-schedule.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Enum for day of week
 */
export enum DayOfWeek {
  OTHER = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
  SUNDAY = 7,
}

@Entity('section_schedule')
export class SectionSchedule {
  @PrimaryGeneratedColumn('increment')
  schedule_id!: number;

  @Column({ name: 'section_id' })
  section_id!: number;

  @Column({ name: 'day_of_week' })
  day_of_week!: DayOfWeek;

  @Column({ name: 'start_time', type: 'time' })
  start_time!: string;

  @Column({ name: 'end_time', type: 'time' })
  end_time!: string;

  @Column({ name: 'room_location_id', type: 'int', nullable: true })
  room_location_id!: number | null;

  @Column({ name: 'flag_valid', default: true })
  flag_valid!: boolean;
}
