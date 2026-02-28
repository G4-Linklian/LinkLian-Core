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
import { ImportTeacherService } from './import-teacher.service';
import { ImportTeacherReqDto } from './dto/import-teacher.dto';

export interface ValidationResponse {
  success: boolean;
  data: {
    validatedData: any[];
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

@ApiTags('Import Teacher')
@Controller('import-teacher')
export class ImportTeacherController {
  constructor(private readonly importTeacherService: ImportTeacherService) {}

  @Post('validate')
  @ApiOperation({ summary: 'Validate teacher data from Excel file' })
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
        instType: {
          type: 'string',
          description: 'ประเภทสถาบัน (school / university)',
          example: 'school',
        },
      },
      required: ['file', 'instId', 'instType'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Validation result with errors and valid data',
  })
  @ApiResponse({ status: 400, description: 'Invalid file or missing header' })
  @UseInterceptors(FileInterceptor('file'))
  async validateTeacherImport(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ImportTeacherReqDto,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    return this.importTeacherService.validateTeacherData(
      body.instId,
      body.instType,
      file.buffer,
    );
  }

  @Post('save')
  // @HttpCode(200)
  @ApiOperation({ summary: 'Save validated teacher data to database' })
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
        instType: {
          type: 'string',
          description: 'ประเภทสถาบัน (school / university)',
          example: 'school',
        },
        validationToken: {
          type: 'string',
          description: 'Token ที่ได้จาก validate endpoint',
        },
      },
      required: ['file', 'instId', 'instType', 'validationToken'],
    },
  })
  @ApiResponse({ status: 200, description: 'Successfully saved teacher data' })
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
  async saveTeacherData(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ImportTeacherReqDto,
    @Body('validationToken') validationToken: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    return this.importTeacherService.saveTeacherData(
      body.instId,
      body.instType,
      file.buffer,
      validationToken,
    );
  }
}
