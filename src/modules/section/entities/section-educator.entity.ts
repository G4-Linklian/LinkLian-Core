// section-educator.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Enum for educator position in section
 */
export enum EducatorPosition {
  MAIN = 'main',
  ASSISTANT = 'assistant',
  SUBSTITUTE = 'substitute',
}

@Entity('section_educator')
export class SectionEducator {
  @PrimaryGeneratedColumn('increment')
  section_educator_id: number;

  @Column({ name: 'section_id' })
  section_id: number;

  @Column({ name: 'educator_id' })
  educator_id: number;

  @Column({ name: 'position' })
  position: string;

  @Column({ name: 'flag_valid', default: true })
  flag_valid: boolean;
}
