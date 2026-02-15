// room-location.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('room_location')
export class RoomLocation {
  @PrimaryGeneratedColumn('increment')
  room_location_id!: number;

  @Column({ name: 'building_id' })
  building_id!: number;

  @Column({ name: 'room_number' })
  room_number!: string;

  @Column({ name: 'room_remark', type: 'text', nullable: true })
  room_remark?: string | null;

  @Column({ name: 'floor' })
  floor!: string;

  @Column({ name: 'flag_valid', default: true })
  flag_valid!: boolean;

}
