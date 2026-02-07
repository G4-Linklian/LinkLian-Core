// semester.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BadRequestException, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';

import { SemesterService } from './semester.service';
import { Semester } from './entities/semester.entity';
import { SemesterSubjectNormalize } from './entities/semester-subject-normalize.entity';
import {
  SearchSemesterDto,
  CreateSemesterDto,
  UpdateSemesterDto,
  CreateSemesterSubjectDto,
  DeleteSemesterSubjectDto
} from './dto/semester.dto';

// Mock data
const mockSemester = {
  semester_id: 1,
  inst_id: 1,
  semester: '1/2567',
  start_date: new Date('2024-05-01'),
  end_date: new Date('2024-09-30'),
  flag_valid: true,
  status: 'active',
  created_at: new Date(),
  updated_at: new Date(),
};

const mockSemesterSubject = {
  semester_subject_normalize_id: 1,
  subject_id: 1,
  semester_id: 1,
  flag_valid: true,
};

describe('SemesterService', () => {
  let service: SemesterService;
  let semesterRepo: Repository<Semester>;
  let semesterSubjectRepo: Repository<SemesterSubjectNormalize>;
  let dataSource: DataSource;

  // Mock repositories
  const mockSemesterRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockSemesterSubjectRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SemesterService,
        {
          provide: getRepositoryToken(Semester),
          useValue: mockSemesterRepo,
        },
        {
          provide: getRepositoryToken(SemesterSubjectNormalize),
          useValue: mockSemesterSubjectRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<SemesterService>(SemesterService);
    semesterRepo = module.get<Repository<Semester>>(getRepositoryToken(Semester));
    semesterSubjectRepo = module.get<Repository<SemesterSubjectNormalize>>(getRepositoryToken(SemesterSubjectNormalize));
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return semester when found', async () => {
      mockSemesterRepo.findOne.mockResolvedValue(mockSemester);

      const result = await service.findById(1);

      expect(result).toEqual({ data: mockSemester });
      expect(mockSemesterRepo.findOne).toHaveBeenCalledWith({
        where: { semester_id: 1 }
      });
    });

    it('should throw NotFoundException when semester not found', async () => {
      mockSemesterRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('search', () => {
    it('should throw BadRequestException when no search parameters provided', async () => {
      const dto: SearchSemesterDto = {};

      await expect(service.search(dto)).rejects.toThrow(BadRequestException);
    });

    it('should return search results when valid parameters provided', async () => {
      const dto: SearchSemesterDto = {
        semester_id: 1,
        limit: 10,
        offset: 0
      };

      const mockResult = [{ ...mockSemester, total_count: 1 }];
      mockDataSource.query.mockResolvedValue(mockResult);

      const result = await service.search(dto);

      expect(result).toEqual({ data: mockResult });
      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should handle database error gracefully', async () => {
      const dto: SearchSemesterDto = { semester_id: 1 };
      mockDataSource.query.mockRejectedValue(new Error('Database error'));

      await expect(service.search(dto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getActiveSemesters', () => {
    it('should return active semesters sorted by year and term', async () => {
      const mockActiveSemesters = [
        { ...mockSemester, semester: '1/2567', year_numeric: 2567, term_numeric: 1 },
        { ...mockSemester, semester: '2/2567', year_numeric: 2567, term_numeric: 2 },
      ];

      mockDataSource.query.mockResolvedValue(mockActiveSemesters);

      const result = await service.getActiveSemesters();

      expect(result).toEqual(mockActiveSemesters);
      expect(mockDataSource.query).toHaveBeenCalledWith(expect.stringContaining('WHERE status IN (\'open\', \'close\')'));
    });

    it('should handle database error in getActiveSemesters', async () => {
      mockDataSource.query.mockRejectedValue(new Error('Database error'));

      await expect(service.getActiveSemesters()).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('create', () => {
    const createDto: CreateSemesterDto = {
      inst_id: 1,
      semester: '1/2567',
      start_date: '2024-05-01',
      end_date: '2024-09-30',
      flag_valid: true,
      status: 'active',
    };

    it('should create semester successfully', async () => {
      mockSemesterRepo.create.mockReturnValue(mockSemester);
      mockSemesterRepo.save.mockResolvedValue(mockSemester);

      const result = await service.create(createDto);

      expect(result.message).toBe('Semester created successfully!');
      expect(result.data).toEqual(mockSemester);
      expect(mockSemesterRepo.create).toHaveBeenCalled();
      expect(mockSemesterRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when required fields missing', async () => {
      const invalidDto = { inst_id: 1 } as CreateSemesterDto;

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when duplicate semester', async () => {
      mockSemesterRepo.create.mockReturnValue(mockSemester);
      mockSemesterRepo.save.mockRejectedValue({ code: '23505' });

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('should handle other database errors', async () => {
      mockSemesterRepo.create.mockReturnValue(mockSemester);
      mockSemesterRepo.save.mockRejectedValue(new Error('Database error'));

      await expect(service.create(createDto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateSemesterDto = {
      semester: '2/2567',
      status: 'completed',
    };

    it('should update semester successfully', async () => {
      const updatedSemester = { ...mockSemester, ...updateDto };
      
      mockSemesterRepo.findOne
        .mockResolvedValueOnce(mockSemester) // First call to check existence
        .mockResolvedValueOnce(updatedSemester); // Second call to return updated data
      
      mockSemesterRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, updateDto);

      expect(result.message).toBe('Semester updated successfully!');
      expect(result.data).toEqual(updatedSemester);
    });

    it('should throw NotFoundException when semester not found', async () => {
      mockSemesterRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no fields to update', async () => {
      mockSemesterRepo.findOne.mockResolvedValue(mockSemester);

      await expect(service.update(1, {})).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when duplicate semester in update', async () => {
      mockSemesterRepo.findOne.mockResolvedValue(mockSemester);
      mockSemesterRepo.update.mockRejectedValue({ code: '23505' });

      await expect(service.update(1, updateDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('should delete semester successfully', async () => {
      mockSemesterRepo.findOne.mockResolvedValue(mockSemester);
      mockSemesterRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.delete(1);

      expect(result.message).toBe('Semester deleted successfully!');
      expect(result.data).toEqual(mockSemester);
    });

    it('should throw NotFoundException when semester not found', async () => {
      mockSemesterRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });

    it('should handle database error in delete', async () => {
      mockSemesterRepo.findOne.mockResolvedValue(mockSemester);
      mockSemesterRepo.delete.mockRejectedValue(new Error('Database error'));

      await expect(service.delete(1)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('createSemesterSubject', () => {
    const createSubjectDto: CreateSemesterSubjectDto = {
      subject_id: 1,
      semester_id: 1,
      flag_valid: true,
    };

    it('should create semester subject successfully', async () => {
      mockSemesterSubjectRepo.create.mockReturnValue(mockSemesterSubject);
      mockSemesterSubjectRepo.save.mockResolvedValue(mockSemesterSubject);

      const result = await service.createSemesterSubject(createSubjectDto);

      expect(result.message).toBe('Semester subject created successfully!');
      expect(result.data).toEqual(mockSemesterSubject);
    });

    it('should throw BadRequestException when required fields missing', async () => {
      const invalidDto = { subject_id: 1 } as CreateSemesterSubjectDto;

      await expect(service.createSemesterSubject(invalidDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when duplicate relation', async () => {
      mockSemesterSubjectRepo.create.mockReturnValue(mockSemesterSubject);
      mockSemesterSubjectRepo.save.mockRejectedValue({ code: '23505' });

      await expect(service.createSemesterSubject(createSubjectDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteSemesterSubject', () => {
    const deleteSubjectDto: DeleteSemesterSubjectDto = {
      subject_id: 1,
      semester_id: 1,
    };

    it('should delete semester subject successfully', async () => {
      mockDataSource.query.mockResolvedValue([mockSemesterSubject]);

      const result = await service.deleteSemesterSubject(deleteSubjectDto);

      expect(result.message).toBe('Semester subject deleted successfully!');
      expect(result.data).toEqual(mockSemesterSubject);
    });

    it('should throw BadRequestException when required fields missing', async () => {
      const invalidDto = { subject_id: 1 } as DeleteSemesterSubjectDto;

      await expect(service.deleteSemesterSubject(invalidDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when record not found', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await expect(service.deleteSemesterSubject(deleteSubjectDto)).rejects.toThrow(NotFoundException);
    });

    it('should handle database error in deleteSemesterSubject', async () => {
      mockDataSource.query.mockRejectedValue(new Error('Database error'));

      await expect(service.deleteSemesterSubject(deleteSubjectDto)).rejects.toThrow(InternalServerErrorException);
    });
  });
});