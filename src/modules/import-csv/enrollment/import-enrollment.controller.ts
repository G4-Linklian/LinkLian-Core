import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportEnrollmentService } from './import-enrollment.service';
import { ImportEnrollmentReqDto } from './dto/import-enrollment.dto';

export interface ValidationResponse {
  success: boolean;
  data: {
    summary: {
      total: number;
      validCount: number;
      errorCount: number;
      duplicateCount: number;
      warningCount: number;
      willSaveCount: number;
    };
  };
  validationToken?: string | null;
}

@ApiTags('Import Enrollment')
@Controller('import-enrollment')
export class ImportEnrollmentController {
  constructor(
    private readonly importEnrollmentService: ImportEnrollmentService,
  ) {}

  @Post('validate')
  @ApiOperation({ summary: 'Validate enrollment data from Excel file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel file (.xlsx)',
        },
        instId: {
          type: 'integer',
          description: 'ID ของสถาบัน',
          example: 1,
        },
        sectionId: {
          type: 'integer',
          description: 'ID ของกลุ่มเรียน',
          example: 1,
        },
      },
      required: ['file', 'instId', 'sectionId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Validation result with errors and valid data',
  })
  @ApiResponse({ status: 400, description: 'Invalid file or missing header' })
  @UseInterceptors(FileInterceptor('file'))
  async validateEnrollmentImport(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ImportEnrollmentReqDto,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    return this.importEnrollmentService.validateEnrollmentData(
      body.instId,
      body.sectionId,
      file.buffer,
    );
  }

  @Post('save')
  @ApiOperation({ summary: 'Save validated enrollment data to database' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel file (.xlsx)',
        },
        instId: {
          type: 'integer',
          description: 'ID ของสถาบัน',
          example: 1,
        },
        sectionId: {
          type: 'integer',
          description: 'ID ของกลุ่มเรียน',
          example: 1,
        },
        validationToken: {
          type: 'string',
          description: 'Token ที่ได้จาก validate endpoint',
        },
      },
      required: ['file', 'instId', 'sectionId', 'validationToken'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully saved enrollment data',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file, missing header, or validation error',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired validation token',
  })
  @ApiResponse({ status: 500, description: 'Save failed' })
  @UseInterceptors(FileInterceptor('file'))
  async saveEnrollmentData(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ImportEnrollmentReqDto,
    @Body('validationToken') validationToken: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    return this.importEnrollmentService.saveEnrollmentData(
      body.instId,
      body.sectionId,
      file.buffer,
      validationToken,
    );
  }
}
