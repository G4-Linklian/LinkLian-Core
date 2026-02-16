// institution.service.ts
import { Injectable, BadRequestException, ConflictException, InternalServerErrorException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Institution } from './entities/institution.entity';
import { CreateInstitutionDto, SearchInstitutionDto, UpdateInstitutionDto, LoginInstitutionDto } from './dto/institution.dto';
import { hashPassword, verifyPassword, generateJwtToken } from 'src/common/utils/auth.util';
import { comparePassword } from 'src/common/utils/auth.utils';

@Injectable()
export class InstitutionService {
  constructor(
    @InjectRepository(Institution)
    private institutionRepo: Repository<Institution>,
  ) {}

  async findById(id: number) {
    const institution = await this.institutionRepo.findOne({
      where: { inst_id: id }
    });

    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    const { inst_password, ...result } = institution;
    return result;
  }

  async findDetailById(id: number) {
    const hasInput = id;

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    try {
      const result = await this.institutionRepo
        .createQueryBuilder('i')
        .select([
          'i.inst_id as inst_id',
          'i.inst_email as inst_email',
          'i.inst_name_th as inst_name_th',
          'i.inst_name_en as inst_name_en',
          'i.inst_abbr_th as inst_abbr_th',
          'i.inst_abbr_en as inst_abbr_en',
          'i.inst_type as inst_type',
          'i.inst_phone as inst_phone',
          'i.website as website',
          'i.address as address',
          'i.subdistrict as subdistrict',
          'i.district as district',
          'i.province as province',
          'i.postal_code as postal_code',
          'i.logo_url as logo_url',
          'i.docs_url as docs_url',
          'i.approve_status as approve_status',
          'COALESCE(student_count.count, 0) as student_count',
          'COALESCE(teacher_count.count, 0) as teacher_count',
          'open_semester.semester as open_semester'
        ])
        .leftJoin(
          subQuery => {
            return subQuery
              .select('p.inst_id', 'inst_id')
              .addSelect('COUNT(*)', 'count')
              .from('user_sys', 'us')
              .leftJoin('user_sys_program_normalize', 'usp', 'us.user_sys_id = usp.user_sys_id')
              .leftJoin('program', 'p', 'p.program_id = usp.program_id')
              .where('us.user_status = :active', { active: 'Active' })
              .groupBy('p.inst_id');
          },
          'student_count',
          'i.inst_id = student_count.inst_id',
        )
        .leftJoin(
          subQuery => {
            return subQuery
              .select('la.inst_id', 'inst_id')
              .addSelect('COUNT(*)', 'count')
              .from('user_sys', 'us')
              .leftJoin('user_sys_learning_area_normalize', 'usla', 'us.user_sys_id = usla.user_sys_id')
              .leftJoin('learning_area', 'la', 'la.learning_area_id = usla.learning_area_id')
              .where('us.user_status = :active', { active: 'Active' })
              .groupBy('la.inst_id');
          },
          'teacher_count',
          'i.inst_id = teacher_count.inst_id'
        )
        .leftJoin(
          subQuery => {
            return subQuery
              .select('s.inst_id', 'inst_id')
              .addSelect('s.semester', 'semester')
              .from('semester', 's')
              .where('s.status = :status', { status: 'open' });
          },
          'open_semester',
          'i.inst_id = open_semester.inst_id'
        )
        .where('i.inst_id = :id', { id })
        .getRawOne();

      if (!result) {
        throw new NotFoundException('Institution not found');
      }

      return result;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error fetching institution details');
    }
  }

  async searchInstitution(dto: SearchInstitutionDto) {
    const hasInput = dto.inst_id || dto.inst_email || dto.inst_name_th || dto.inst_name_en ||
                     dto.inst_abbr_th || dto.inst_abbr_en || dto.inst_type || dto.approve_status ||
                     dto.from || typeof dto.flag_valid === 'boolean';

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    const query = this.institutionRepo.createQueryBuilder('i')
      .select([
        'i.*',
        'COUNT(*) OVER() AS total_count'
      ]);

    if (dto.inst_id) query.andWhere('i.inst_id = :instId', { instId: dto.inst_id });
    if (dto.inst_email) query.andWhere('i.inst_email = :instEmail', { instEmail: dto.inst_email });
    if (dto.inst_name_th) query.andWhere('i.inst_name_th = :instNameTh', { instNameTh: dto.inst_name_th });
    if (dto.inst_name_en) query.andWhere('i.inst_name_en = :instNameEn', { instNameEn: dto.inst_name_en });
    if (dto.inst_abbr_th) query.andWhere('i.inst_abbr_th = :instAbbrTh', { instAbbrTh: dto.inst_abbr_th });
    if (dto.inst_abbr_en) query.andWhere('i.inst_abbr_en = :instAbbrEn', { instAbbrEn: dto.inst_abbr_en });
    if (dto.inst_type) query.andWhere('i.inst_type = :instType', { instType: dto.inst_type });
    if (dto.approve_status) query.andWhere('i.approve_status = :approveStatus', { approveStatus: dto.approve_status });
    
    if (typeof dto.flag_valid === 'boolean') {
      query.andWhere('i.flag_valid = :flagValid', { flagValid: dto.flag_valid });
    }

    if (dto.from === 'admin') {
      query.andWhere(new Brackets(qb => {
        qb.where('i.approve_status = :approved', { approved: 'approved' })
          .orWhere('i.approve_status = :rejected', { rejected: 'rejected' });
      }));
    }

    if (dto.sort_by) {
      const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query.orderBy(`i.${dto.sort_by}`, order);
    }

    if (dto.limit) query.limit(dto.limit);
    if (dto.offset) query.offset(dto.offset);

    try {
      const result = await query.getRawMany();
      return result;
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }

  async createInstitution(dto: CreateInstitutionDto) {
    const existingInst = await this.institutionRepo.findOne({
      where: { inst_email: dto.inst_email }
    });

    if (existingInst) {
      throw new ConflictException('Email already exists!');
    }

    try {
      const hashedPassword = await hashPassword(dto.inst_password);

      const newInstitution = this.institutionRepo.create({
        ...dto,
        inst_password: hashedPassword,
        approve_status: 'pending',
      });

      await this.institutionRepo.save(newInstitution);
      return { message: "Institution created successfully!" };

    } catch (error : any) {
      if (error.code === '23505') {
        throw new ConflictException('Email already exists!');
      }
      throw new InternalServerErrorException('Error creating institution');
    }
  }

  async updateInstitution(id: number, dto: UpdateInstitutionDto) {
    const existing = await this.institutionRepo.findOne({
      where: { inst_id: id }
    });

    if (!existing) {
      throw new NotFoundException('Institution not found');
    }

    const fieldsToUpdate: Partial<Institution> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined && value !== null) {
        fieldsToUpdate[key] = value;
      }
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      throw new BadRequestException('No fields to update!');
    }

    try {
      await this.institutionRepo.update({ inst_id: id }, fieldsToUpdate);
      return { message: "Institution updated successfully!" };
    } catch (error : any) {
      console.error('Error updating institution:', error);
      throw new InternalServerErrorException('Error updating institution');
    }
  }

  async deleteInstitution(id: number) {
    const existing = await this.institutionRepo.findOne({
      where: { inst_id: id }
    });

    if (!existing) {
      throw new NotFoundException('Institution not found');
    }

    try {
      await this.institutionRepo.delete({ inst_id: id });
      return { message: "Institution deleted successfully!" };
    } catch (error : any) {
      console.error('Error deleting institution:', error);
      throw new InternalServerErrorException('Error deleting institution');
    }
  }

  async loginInstitution(dto: LoginInstitutionDto) {
    if (!dto.inst_email || !dto.inst_password) {
      throw new BadRequestException('Institution email and password are required for verification!');
    }

    try {
      const institution = await this.institutionRepo.findOne({
        where: { inst_email: dto.inst_email }
      });

      if (!institution) {
        throw new UnauthorizedException('Institution not found');
      }

      const isMatch = await comparePassword(dto.inst_password, institution.inst_password);

      if (!isMatch) {
        throw new UnauthorizedException('Incorrect password');
      }

      const { inst_password, ...institutionData } = institution;

      const token = generateJwtToken({ institution: institutionData });

      return {
        message: "Login successful",
        token,
        institution: institutionData.inst_email,
      };

    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      console.error('Error verifying institution:', error);
      throw new InternalServerErrorException('Error verifying institution');
    }
  }
}
