// building.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('building')
export class Building {
  @PrimaryGeneratedColumn('increment')
  building_id: number;

  @Column({ name: 'inst_id' })
  inst_id: number;

  @Column({ name: 'building_no' })
  building_no: string;

  @Column({ name: 'building_name' })
  building_name: string;

  @Column({ name: 'remark', type: 'text', nullable: true })
  remark: string | null;

  @Column({ name: 'room_format', type: 'varchar', nullable: true })
  room_format: string | null;

  @Column({ name: 'flag_valid', default: true })
  flag_valid: boolean;

}
