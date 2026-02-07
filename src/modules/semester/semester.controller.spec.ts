// semester.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ParseIntPipe } from '@nestjs/common';
import { SemesterController } from './semester.controller';
import { SemesterService } from './semester.service';
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

describe('SemesterController', () => {
  let controller: SemesterController;
  let service: SemesterService;

  // Mock service
  const mockSemesterService = {
    getActiveSemesters: jest.fn(),
    search: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createSemesterSubject: jest.fn(),
    deleteSemesterSubject: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SemesterController],
      providers: [
        {
          provide: SemesterService,
          useValue: mockSemesterService,
        },
      ],
    }).compile();

    controller = module.get<SemesterController>(SemesterController);
    service = module.get<SemesterService>(SemesterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getActiveSemesters', () => {
    it('should return active semesters', async () => {
      const mockActiveSemesters = [
        { ...mockSemester, semester: '1/2567' },
        { ...mockSemester, semester: '2/2567' },
      ];

      mockSemesterService.getActiveSemesters.mockResolvedValue(mockActiveSemesters);

      const result = await controller.getActiveSemesters();

      expect(result).toEqual(mockActiveSemesters);
      expect(service.getActiveSemesters).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should search semesters with filters', async () => {
      const searchDto: SearchSemesterDto = {
        semester_id: 1,
        inst_id: 1,
        limit: 10,
        offset: 0,
      };

      const mockSearchResult = {
        data: [mockSemester]
      };

      mockSemesterService.search.mockResolvedValue(mockSearchResult);

      const result = await controller.search(searchDto);

      expect(result).toEqual(mockSearchResult);
      expect(service.search).toHaveBeenCalledWith(searchDto);
    });

    it('should handle empty search parameters', async () => {
      const searchDto: SearchSemesterDto = {};

      mockSemesterService.search.mockRejectedValue(new Error('No search parameters provided'));

      await expect(controller.search(searchDto)).rejects.toThrow();
      expect(service.search).toHaveBeenCalledWith(searchDto);
    });
  });

  describe('findById', () => {
    it('should return semester by ID', async () => {
      const mockResult = { data: mockSemester };

      mockSemesterService.findById.mockResolvedValue(mockResult);

      const result = await controller.findById(1);

      expect(result).toEqual(mockResult);
      expect(service.findById).toHaveBeenCalledWith(1);
    });

    it('should handle semester not found', async () => {
      mockSemesterService.findById.mockRejectedValue(new Error('Semester not found'));

      await expect(controller.findById(999)).rejects.toThrow();
      expect(service.findById).toHaveBeenCalledWith(999);
    });
  });

  describe('create', () => {
    it('should create a new semester', async () => {
      const createDto: CreateSemesterDto = {
        inst_id: 1,
        semester: '1/2567',
        start_date: '2024-05-01',
        end_date: '2024-09-30',
        flag_valid: true,
        status: 'active',
      };

      const mockCreateResult = {
        message: 'Semester created successfully!',
        data: mockSemester
      };

      mockSemesterService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockCreateResult);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });

    it('should handle validation errors in create', async () => {
      const invalidDto = {} as CreateSemesterDto;

      mockSemesterService.create.mockRejectedValue(new Error('Missing required fields'));

      await expect(controller.create(invalidDto)).rejects.toThrow();
      expect(service.create).toHaveBeenCalledWith(invalidDto);
    });
  });

  describe('update', () => {
    it('should update semester by ID', async () => {
      const updateDto: UpdateSemesterDto = {
        semester: '2/2567',
        status: 'completed',
      };

      const mockUpdateResult = {
        message: 'Semester updated successfully!',
        data: { ...mockSemester, ...updateDto }
      };

      mockSemesterService.update.mockResolvedValue(mockUpdateResult);

      const result = await controller.update(1, updateDto);

      expect(result).toEqual(mockUpdateResult);
      expect(service.update).toHaveBeenCalledWith(1, updateDto);
    });

    it('should handle semester not found in update', async () => {
      const updateDto: UpdateSemesterDto = { status: 'completed' };

      mockSemesterService.update.mockRejectedValue(new Error('Semester not found'));

      await expect(controller.update(999, updateDto)).rejects.toThrow();
      expect(service.update).toHaveBeenCalledWith(999, updateDto);
    });
  });

  describe('delete', () => {
    it('should delete semester by ID', async () => {
      const mockDeleteResult = {
        message: 'Semester deleted successfully!',
        data: mockSemester
      };

      mockSemesterService.delete.mockResolvedValue(mockDeleteResult);

      const result = await controller.delete(1);

      expect(result).toEqual(mockDeleteResult);
      expect(service.delete).toHaveBeenCalledWith(1);
    });

    it('should handle semester not found in delete', async () => {
      mockSemesterService.delete.mockRejectedValue(new Error('Semester not found'));

      await expect(controller.delete(999)).rejects.toThrow();
      expect(service.delete).toHaveBeenCalledWith(999);
    });
  });

  describe('createSemesterSubject', () => {
    it('should create semester subject record', async () => {
      const createSubjectDto: CreateSemesterSubjectDto = {
        subject_id: 1,
        semester_id: 1,
        flag_valid: true,
      };

      const mockCreateResult = {
        message: 'Semester subject created successfully!',
        data: mockSemesterSubject
      };

      mockSemesterService.createSemesterSubject.mockResolvedValue(mockCreateResult);

      const result = await controller.createSemesterSubject(createSubjectDto);

      expect(result).toEqual(mockCreateResult);
      expect(service.createSemesterSubject).toHaveBeenCalledWith(createSubjectDto);
    });

    it('should handle validation errors in createSemesterSubject', async () => {
      const invalidDto = {} as CreateSemesterSubjectDto;

      mockSemesterService.createSemesterSubject.mockRejectedValue(new Error('Missing required fields'));

      await expect(controller.createSemesterSubject(invalidDto)).rejects.toThrow();
      expect(service.createSemesterSubject).toHaveBeenCalledWith(invalidDto);
    });

    it('should handle duplicate semester subject relation', async () => {
      const createSubjectDto: CreateSemesterSubjectDto = {
        subject_id: 1,
        semester_id: 1,
        flag_valid: true,
      };

      mockSemesterService.createSemesterSubject.mockRejectedValue(new Error('Subject is already linked to this semester'));

      await expect(controller.createSemesterSubject(createSubjectDto)).rejects.toThrow();
      expect(service.createSemesterSubject).toHaveBeenCalledWith(createSubjectDto);
    });
  });

  describe('deleteSemesterSubject', () => {
    it('should delete semester subject record', async () => {
      const deleteSubjectDto: DeleteSemesterSubjectDto = {
        subject_id: 1,
        semester_id: 1,
      };

      const mockDeleteResult = {
        message: 'Semester subject deleted successfully!',
        data: mockSemesterSubject
      };

      mockSemesterService.deleteSemesterSubject.mockResolvedValue(mockDeleteResult);

      const result = await controller.deleteSemesterSubject(deleteSubjectDto);

      expect(result).toEqual(mockDeleteResult);
      expect(service.deleteSemesterSubject).toHaveBeenCalledWith(deleteSubjectDto);
    });

    it('should handle validation errors in deleteSemesterSubject', async () => {
      const invalidDto = {} as DeleteSemesterSubjectDto;

      mockSemesterService.deleteSemesterSubject.mockRejectedValue(new Error('Subject ID and Semester ID are required'));

      await expect(controller.deleteSemesterSubject(invalidDto)).rejects.toThrow();
      expect(service.deleteSemesterSubject).toHaveBeenCalledWith(invalidDto);
    });

    it('should handle semester subject record not found', async () => {
      const deleteSubjectDto: DeleteSemesterSubjectDto = {
        subject_id: 999,
        semester_id: 999,
      };

      mockSemesterService.deleteSemesterSubject.mockRejectedValue(new Error('Semester subject record not found'));

      await expect(controller.deleteSemesterSubject(deleteSubjectDto)).rejects.toThrow();
      expect(service.deleteSemesterSubject).toHaveBeenCalledWith(deleteSubjectDto);
    });
  });

  // Test parameter validation
  describe('Parameter Validation', () => {
    it('should handle invalid ID parameter type', async () => {
      // This would be handled by NestJS ParseIntPipe validation
      // The pipe will throw error before reaching controller method
      const pipe = new ParseIntPipe();
      const metadata = {
        type: 'param' as const,
        data: 'id',
        metatype: Number,
      };

      await expect(pipe.transform('invalid', metadata)).rejects.toThrow('Validation failed (numeric string is expected)');
    });
  });
});