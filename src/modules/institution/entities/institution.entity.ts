import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('institution') // ชื่อ Table ใน Database
export class Institution {
  @PrimaryGeneratedColumn('increment')
  inst_id: number;

  @Column({ name: 'inst_email', unique: true })
  inst_email: string;

  @Column({ name: 'inst_password' })
  inst_password: string;

  @Column({ name: 'inst_name_th' })
  inst_name_th: string;

  @Column({ name: 'inst_name_en' })
  inst_name_en: string;

  @Column({ name: 'inst_abbr_th' })
  inst_abbr_th: string;

  @Column({ name: 'inst_abbr_en' })
  inst_abbr_en: string;

  @Column({ name: 'inst_type' })
  inst_type: string;

  @Column({ name: 'inst_phone', nullable: true })
  inst_phone: string;

  @Column({ name: 'website', nullable: true })
  website: string;

  @Column({ name: 'address', nullable: true })
  address: string;

  @Column({ name: 'subdistrict', nullable: true })
  subdistrict: string;

  @Column({ name: 'district', nullable: true })
  district: string;

  @Column({ name: 'province', nullable: true })
  province: string;

  @Column({ name: 'postal_code', nullable: true })
  postal_code: string;

  @Column({ name: 'logo_url', nullable: true })
  logo_url: string;

  @Column({ name: 'docs_url', nullable: true })
  docs_url: string;

  @Column({ name: 'approve_status', default: 'pending' })
  approve_status: string;

  @Column({ name: 'flag_valid', default: true })
  flag_valid: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
