import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstitutionService } from './institution.service';
import { InstitutionController } from './institution.controller';
import { Institution } from './entities/institution.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Institution])], // Register Entity ตรงนี้
  controllers: [InstitutionController],
  providers: [InstitutionService],
  exports: [InstitutionService], // export ถ้า module อื่นต้องใช้
})
export class InstitutionModule {}
