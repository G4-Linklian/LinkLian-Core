import { 
  Controller, 
  Post, 
  UseInterceptors, 
  UploadedFile, 
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Body
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportStudentService } from './import-student.service';
import { ImportStudentReqDto } from './dto/import-student.dto';

export interface ValidationResponse {
    success: boolean;
    data: {
        validatedData: any[];
        summary: {
            total: number;
            validCount: number;
            errorCount: number;
        }
    };
    validationToken?: string | null;
}

@ApiTags('Import Student')
@Controller('import-student')
export class ImportStudentController {
    constructor(private readonly importStudentService: ImportStudentService) {}

    @Post('validate')
    // @HttpCode(200)
    @ApiOperation({ summary: 'Validate student data from Excel file' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Excel file (.xlsx)'
                },
                instId: {
                    type: 'integer',
                    description: 'ID ของสถาบัน',
                    example: 1
                },
                instType: {
                    type: 'string',
                    description: 'ประเภทสถาบัน (school / university)',
                    example: 'school'
                }
            },
            required: ['file', 'instId', 'instType']
        },
    })
    @ApiResponse({ status: 200, description: 'Validation result with errors and valid data'})
    @ApiResponse({ status: 400, description: 'Invalid file or missing header' })
    @UseInterceptors(FileInterceptor('file'))
    async validateStudentImport(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: ImportStudentReqDto,
    ) {
        if (!file) throw new BadRequestException('No file uploaded');

        return this.importStudentService.validateStudentData(
            body.instId,
            body.instType,
            file.buffer
        );
    }

    @Post('save')
    // @HttpCode(200)
    @ApiOperation({ summary: 'Save validated student data to database' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Excel file (.xlsx)'
                },
                instId: {
                    type: 'integer',
                    description: 'ID ของสถาบัน',
                    example: 1
                },
                instType: {
                    type: 'string',
                    description: 'ประเภทสถาบัน (school / university)',
                    example: 'school'
                },
                validationToken: {
                    type: 'string',
                    description: 'Token ที่ได้จาก validate endpoint'
                }
            },
            required: ['file', 'instId', 'instType', 'validationToken']
        },
    })
    @ApiResponse({ status: 200, description: 'Successfully saved student data'})
    @ApiResponse({ status: 400, description: 'Invalid file, missing header, or validation error' })
    @ApiResponse({ status: 401, description: 'Invalid or expired validation token' })
    @ApiResponse({ status: 500, description: 'Save failed' })
    @UseInterceptors(FileInterceptor('file'))
    async saveStudentData(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: ImportStudentReqDto,
        @Body('validationToken') validationToken: string
    ) {
        if (!file) throw new BadRequestException('No file uploaded');

        return this.importStudentService.saveStudentData(
            body.instId,
            body.instType,
            file.buffer,
            validationToken
        );
    }
}