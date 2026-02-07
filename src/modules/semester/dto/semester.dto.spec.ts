// semester.dto.spec.ts
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import {
  SearchSemesterDto,
  CreateSemesterDto,
  UpdateSemesterDto,
  CreateSemesterSubjectDto,
  DeleteSemesterSubjectDto
} from './semester.dto';

describe('Semester DTOs', () => {
  describe('SearchSemesterDto', () => {
    it('should pass validation with valid data', async () => {
      const dto = plainToClass(SearchSemesterDto, {
        semester_id: 1,
        inst_id: 1,
        semester: '1/2567',
        start_date: '2024-05-01',
        end_date: '2024-09-30',
        flag_valid: true,
        status: 'active',
        sort_by: 'semester_id',
        sort_order: 'ASC',
        limit: 10,
        offset: 0
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid semester_id type', async () => {
      const dto = plainToClass(SearchSemesterDto, {
        semester_id: 'invalid'
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('semester_id');
    });

    it('should pass validation with empty object (all optional)', async () => {
      const dto = plainToClass(SearchSemesterDto, {});
      
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should transform flag_valid string to boolean', async () => {
      const dto = plainToClass(SearchSemesterDto, {
        flag_valid: 'true'
      });

      expect(dto.flag_valid).toBe(true);
    });
  });

  describe('CreateSemesterDto', () => {
    it('should pass validation with valid data', async () => {
      const dto = plainToClass(CreateSemesterDto, {
        inst_id: 1,
        semester: '1/2567',
        start_date: '2024-05-01',
        end_date: '2024-09-30',
        flag_valid: true,
        status: 'active'
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with missing required fields', async () => {
      const dto = plainToClass(CreateSemesterDto, {
        semester: '1/2567'
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      
      const propertyNames = errors.map(error => error.property);
      expect(propertyNames).toContain('inst_id');
    });

    it('should fail validation with invalid date format', async () => {
      const dto = plainToClass(CreateSemesterDto, {
        inst_id: 1,
        semester: '1/2567',
        start_date: 'invalid-date',
        end_date: '2024-09-30',
        flag_valid: true
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation with invalid semester status', async () => {
      const dto = plainToClass(CreateSemesterDto, {
        inst_id: 1,
        semester: '1/2567',
        start_date: '2024-05-01',
        end_date: '2024-09-30',
        flag_valid: true,
        status: 'invalid_status'
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      
      const statusError = errors.find(error => error.property === 'status');
      expect(statusError).toBeDefined();
    });
  });

  describe('UpdateSemesterDto', () => {
    it('should pass validation with valid partial data', async () => {
      const dto = plainToClass(UpdateSemesterDto, {
        semester: '2/2567',
        status: 'completed'
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with empty object (all optional)', async () => {
      const dto = plainToClass(UpdateSemesterDto, {});
      
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid data types', async () => {
      const dto = plainToClass(UpdateSemesterDto, {
        inst_id: 'not_a_number',
        flag_valid: 'not_a_boolean'
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('CreateSemesterSubjectDto', () => {
    it('should pass validation with valid data', async () => {
      const dto = plainToClass(CreateSemesterSubjectDto, {
        subject_id: 1,
        semester_id: 1,
        flag_valid: true
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with missing required fields', async () => {
      const dto = plainToClass(CreateSemesterSubjectDto, {
        subject_id: 1
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      
      const propertyNames = errors.map(error => error.property);
      expect(propertyNames).toContain('semester_id');
      expect(propertyNames).toContain('flag_valid');
    });

    it('should fail validation with invalid data types', async () => {
      const dto = plainToClass(CreateSemesterSubjectDto, {
        subject_id: 'not_a_number',
        semester_id: 'not_a_number',
        flag_valid: 'not_a_boolean'
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('DeleteSemesterSubjectDto', () => {
    it('should pass validation with valid data', async () => {
      const dto = plainToClass(DeleteSemesterSubjectDto, {
        subject_id: 1,
        semester_id: 1
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with missing required fields', async () => {
      const dto = plainToClass(DeleteSemesterSubjectDto, {
        subject_id: 1
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      
      const propertyNames = errors.map(error => error.property);
      expect(propertyNames).toContain('semester_id');
    });

    it('should fail validation with invalid data types', async () => {
      const dto = plainToClass(DeleteSemesterSubjectDto, {
        subject_id: 'not_a_number',
        semester_id: 'not_a_number'
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});