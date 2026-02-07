// semester.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SemesterModule } from './semester.module';
import { Semester } from './entities/semester.entity';
import { SemesterSubjectNormalize } from './entities/semester-subject-normalize.entity';

describe('SemesterController (e2e)', () => {
  let app: INestApplication;
  let semesterRepo: Repository<Semester>;
  let semesterSubjectRepo: Repository<SemesterSubjectNormalize>;

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
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SemesterModule],
    })
    .overrideProvider(getRepositoryToken(Semester))
    .useValue(mockSemesterRepo)
    .overrideProvider(getRepositoryToken(SemesterSubjectNormalize))
    .useValue(mockSemesterSubjectRepo)
    .overrideProvider('DataSource')
    .useValue(mockDataSource)
    .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }));

    await app.init();

    semesterRepo = moduleFixture.get<Repository<Semester>>(getRepositoryToken(Semester));
    semesterSubjectRepo = moduleFixture.get<Repository<SemesterSubjectNormalize>>(getRepositoryToken(SemesterSubjectNormalize));
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('/semester (GET)', () => {
    it('should search semesters with valid parameters', () => {
      const mockResult = {
        data: [{
          semester_id: 1,
          inst_id: 1,
          semester: '1/2567',
          start_date: '2024-05-01',
          end_date: '2024-09-30',
          flag_valid: true,
          status: 'active',
          total_count: 1
        }]
      };

      mockDataSource.query.mockResolvedValue(mockResult.data);

      return request(app.getHttpServer())
        .get('/semester')
        .query({ semester_id: 1 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
        });
    });

    it('should return 400 when no search parameters provided', () => {
      return request(app.getHttpServer())
        .get('/semester')
        .expect(400);
    });
  });

  describe('/semester/active/list (GET)', () => {
    it('should get active semesters', () => {
      const mockActiveSemesters = [
        {
          semester_id: 1,
          inst_id: 1,
          semester: '1/2567',
          status: 'open',
          flag_valid: true,
          year_numeric: 2567,
          term_numeric: 1
        },
        {
          semester_id: 2,
          inst_id: 1,
          semester: '2/2567',
          status: 'close',
          flag_valid: true,
          year_numeric: 2567,
          term_numeric: 2
        }
      ];

      mockDataSource.query.mockResolvedValue(mockActiveSemesters);

      return request(app.getHttpServer())
        .get('/semester/active/list')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(0);
        });
    });
  });

  describe('/semester/:id (GET)', () => {
    it('should get semester by valid ID', () => {
      const mockSemester = {
        semester_id: 1,
        inst_id: 1,
        semester: '1/2567',
        start_date: new Date('2024-05-01'),
        end_date: new Date('2024-09-30'),
        flag_valid: true,
        status: 'active'
      };

      mockSemesterRepo.findOne.mockResolvedValue(mockSemester);

      return request(app.getHttpServer())
        .get('/semester/1')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.data.semester_id).toBe(1);
        });
    });

    it('should return 404 when semester not found', () => {
      mockSemesterRepo.findOne.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/semester/999')
        .expect(404);
    });

    it('should return 400 for invalid ID parameter', () => {
      return request(app.getHttpServer())
        .get('/semester/invalid')
        .expect(400);
    });
  });

  describe('/semester (POST)', () => {
    const validCreateData = {
      inst_id: 1,
      semester: '1/2567',
      start_date: '2024-05-01',
      end_date: '2024-09-30',
      flag_valid: true,
      status: 'active'
    };

    it('should create semester with valid data', () => {
      const mockCreatedSemester = {
        semester_id: 1,
        ...validCreateData,
        start_date: new Date(validCreateData.start_date),
        end_date: new Date(validCreateData.end_date),
        created_at: new Date(),
        updated_at: new Date()
      };

      mockSemesterRepo.create.mockReturnValue(mockCreatedSemester);
      mockSemesterRepo.save.mockResolvedValue(mockCreatedSemester);

      return request(app.getHttpServer())
        .post('/semester')
        .send(validCreateData)
        .expect(201)
        .expect((res) => {
          expect(res.body.message).toBe('Semester created successfully!');
          expect(res.body.data).toBeDefined();
        });
    });

    it('should return 400 with missing required fields', () => {
      const invalidData = {
        inst_id: 1,
        semester: '1/2567'
        // Missing required fields
      };

      return request(app.getHttpServer())
        .post('/semester')
        .send(invalidData)
        .expect(400);
    });

    it('should return 409 for duplicate semester', () => {
      mockSemesterRepo.create.mockReturnValue(validCreateData);
      mockSemesterRepo.save.mockRejectedValue({ code: '23505' });

      return request(app.getHttpServer())
        .post('/semester')
        .send(validCreateData)
        .expect(409);
    });
  });

  describe('/semester/:id (PUT)', () => {
    const validUpdateData = {
      semester: '2/2567',
      status: 'completed'
    };

    it('should update semester with valid data', () => {
      const mockExistingSemester = {
        semester_id: 1,
        inst_id: 1,
        semester: '1/2567',
        start_date: new Date('2024-05-01'),
        end_date: new Date('2024-09-30'),
        flag_valid: true,
        status: 'active'
      };

      const mockUpdatedSemester = {
        ...mockExistingSemester,
        ...validUpdateData
      };

      mockSemesterRepo.findOne
        .mockResolvedValueOnce(mockExistingSemester)
        .mockResolvedValueOnce(mockUpdatedSemester);
      mockSemesterRepo.update.mockResolvedValue({ affected: 1 });

      return request(app.getHttpServer())
        .put('/semester/1')
        .send(validUpdateData)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Semester updated successfully!');
          expect(res.body.data).toBeDefined();
        });
    });

    it('should return 404 when semester not found', () => {
      mockSemesterRepo.findOne.mockResolvedValue(null);

      return request(app.getHttpServer())
        .put('/semester/999')
        .send(validUpdateData)
        .expect(404);
    });

    it('should return 400 with empty update data', () => {
      const mockExistingSemester = {
        semester_id: 1,
        inst_id: 1,
        semester: '1/2567'
      };

      mockSemesterRepo.findOne.mockResolvedValue(mockExistingSemester);

      return request(app.getHttpServer())
        .put('/semester/1')
        .send({})
        .expect(400);
    });
  });

  describe('/semester/:id (DELETE)', () => {
    it('should delete semester successfully', () => {
      const mockExistingSemester = {
        semester_id: 1,
        inst_id: 1,
        semester: '1/2567',
        start_date: new Date('2024-05-01'),
        end_date: new Date('2024-09-30'),
        flag_valid: true,
        status: 'active'
      };

      mockSemesterRepo.findOne.mockResolvedValue(mockExistingSemester);
      mockSemesterRepo.delete.mockResolvedValue({ affected: 1 });

      return request(app.getHttpServer())
        .delete('/semester/1')
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Semester deleted successfully!');
          expect(res.body.data).toBeDefined();
        });
    });

    it('should return 404 when semester not found', () => {
      mockSemesterRepo.findOne.mockResolvedValue(null);

      return request(app.getHttpServer())
        .delete('/semester/999')
        .expect(404);
    });
  });

  describe('/semester/subject (POST)', () => {
    const validSubjectData = {
      subject_id: 1,
      semester_id: 1,
      flag_valid: true
    };

    it('should create semester subject record', () => {
      const mockCreatedRecord = {
        semester_subject_normalize_id: 1,
        ...validSubjectData
      };

      mockSemesterSubjectRepo.create.mockReturnValue(mockCreatedRecord);
      mockSemesterSubjectRepo.save.mockResolvedValue(mockCreatedRecord);

      return request(app.getHttpServer())
        .post('/semester/subject')
        .send(validSubjectData)
        .expect(201)
        .expect((res) => {
          expect(res.body.message).toBe('Semester subject created successfully!');
          expect(res.body.data).toBeDefined();
        });
    });

    it('should return 400 with missing required fields', () => {
      const invalidData = {
        subject_id: 1
        // Missing required fields
      };

      return request(app.getHttpServer())
        .post('/semester/subject')
        .send(invalidData)
        .expect(400);
    });
  });

  describe('/semester/subject (DELETE)', () => {
    const validDeleteData = {
      subject_id: 1,
      semester_id: 1
    };

    it('should delete semester subject record', () => {
      const mockDeletedRecord = {
        semester_subject_normalize_id: 1,
        subject_id: 1,
        semester_id: 1,
        flag_valid: true
      };

      mockDataSource.query.mockResolvedValue([mockDeletedRecord]);

      return request(app.getHttpServer())
        .delete('/semester/subject')
        .send(validDeleteData)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Semester subject deleted successfully!');
          expect(res.body.data).toBeDefined();
        });
    });

    it('should return 400 with missing required fields', () => {
      const invalidData = {
        subject_id: 1
        // Missing semester_id
      };

      return request(app.getHttpServer())
        .delete('/semester/subject')
        .send(invalidData)
        .expect(400);
    });

    it('should return 404 when record not found', () => {
      mockDataSource.query.mockResolvedValue([]);

      return request(app.getHttpServer())
        .delete('/semester/subject')
        .send(validDeleteData)
        .expect(404);
    });
  });
});