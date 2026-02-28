import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { ImportSubjectService } from './import-subject.service';
import { ImportSubjectReqDto } from './dto/import-subject.dto';

export interface ValidationResponse {
  success: boolean;
  data: {
    validatedData: any[];
    summary: {
      total: number;
      validCount: number;
      errorCount: number;
    };
  };
  validationToken?: string | null;
}

@ApiTags('Import Subject')
@Controller('import-subject')
export class ImportSubjectController {
  constructor(private readonly importSubjectService: ImportSubjectService) {}

  @Post('validate')
  // @HttpCode(200)
  @ApiOperation({ summary: 'Validate subject data from Excel file' })
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
      },
      required: ['file', 'instId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Validation result with errors and valid data',
  })
  @ApiResponse({ status: 400, description: 'Invalid file or missing header' })
  @UseInterceptors(FileInterceptor('file'))
  async validateSubjectImport(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ImportSubjectReqDto,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    return this.importSubjectService.validateSubjectData(
      body.instId,
      file.buffer,
    );
  }

  @Post('save')
  // @HttpCode(200)
  @ApiOperation({ summary: 'Save validated subject data to database' })
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
        validationToken: {
          type: 'string',
          description: 'Token ที่ได้จาก validate endpoint',
        },
      },
      required: ['file', 'instId', 'validationToken'],
    },
  })
  @ApiResponse({ status: 200, description: 'Successfully saved subject data' })
  @ApiResponse({
    status: 400,
    description: 'Invalid file, missing header, missing token, or data changed',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired validation token',
  })
  @ApiResponse({ status: 500, description: 'Save failed' })
  @UseInterceptors(FileInterceptor('file'))
  async saveSubjectData(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ImportSubjectReqDto,
    @Body('validationToken') validationToken: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    return this.importSubjectService.saveSubjectData(
      body.instId,
      file.buffer,
      validationToken,
    );
  }
}
