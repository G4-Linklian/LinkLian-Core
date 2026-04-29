import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
} from 'typeorm';

@Entity('monthly_dashboard')
export class Dashboard {
    @PrimaryGeneratedColumn('increment')
    dashboard_id!: number;

    @Column({ name: 'user_sys_id'})
    user_sys_id!: number;
    
    @Column({ name: 'role_type' })
    role_type!: string;

    @Column({ name: 'report_month' })
    report_month!: string;

    @Column({ name: 'payload', type: 'jsonb' })
    payload!: Record<string, unknown>;

    @CreateDateColumn({ name: 'created_at' })
    created_at!: Date;

    @Column({ name: 'flag_valid' })
    flag_valid!: boolean;;
}