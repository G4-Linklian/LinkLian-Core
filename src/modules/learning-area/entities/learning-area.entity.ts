// learning-area.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('learning_area')
export class LearningArea {
  @PrimaryGeneratedColumn('increment')
  learning_area_id!: number;

  @Column({ name: 'inst_id' })
  inst_id!: number;

  @Column({ name: 'learning_area_name' })
  learning_area_name!: string;

  @Column({ name: 'remark', type: 'text', nullable: true })
  remark?: string | null;

  @Column({ name: 'flag_valid', default: true })
  flag_valid!: boolean;
}
