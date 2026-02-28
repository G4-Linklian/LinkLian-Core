// section-educator.entity.ts
import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Enum for educator position in section
 */
export enum EducatorPosition {
  MAIN_TEACHER = 'main_teacher',
  CO_TEACHER = 'co_teacher',
  TA = 'TA',
}

@Entity('section_educator')
export class SectionEducator {
  @PrimaryColumn({ name: 'section_id' })
  section_id!: number;

  @PrimaryColumn({ name: 'educator_id' })
  educator_id!: number;

  @Column({ name: 'position' })
  position!: EducatorPosition;

  @Column({ name: 'flag_valid', default: true })
  flag_valid!: boolean;
}
