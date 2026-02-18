import { 
  Controller, 
  Post, 
  UseInterceptors, 
  UploadedFile, 
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpCode,
  Body
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportProgramService } from './import-program.service';
import { ImportProgramReqDto } from './dto/import-program.dto';

export interface ValidationResponse {
    success: boolean;
    data: {
        summary: {
            total: number;
            validCount: number;
            errorCount: number;
        };
    }
    validationToken?: string | null;
}

@ApiTags('Import Program')
@Controller('import-program')
export class ImportProgramController {
    constructor(private readonly importProgramService: ImportProgramService) {}

    @Post('validate')
    // @HttpCode(200)
    @ApiOperation({ summary: 'Validate program data from Excel file' })
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
    async validateProgramImport(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: ImportProgramReqDto,
    ) {
        if (!file) throw new BadRequestException('No file uploaded');

        return this.importProgramService.validateProgramData(
            body.instId,
            body.instType,
            file.buffer
        );
    }

    @Post('save')
    // @HttpCode(200)
    @ApiOperation({ summary: 'Save validated program data to database' })
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
    @ApiResponse({ status: 200, description: 'Successfully saved program data'})
    @ApiResponse({ status: 400, description: 'Invalid file, missing header, or validation error' })
    @ApiResponse({ status: 401, description: 'Invalid or expired validation token' })
    @ApiResponse({ status: 500, description: 'Save failed' })
    @UseInterceptors(FileInterceptor('file'))
    async saveProgramData(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: ImportProgramReqDto,
        @Body('validationToken') validationToken: string
    ) {
        if (!file) throw new BadRequestException('No file uploaded');

        return this.importProgramService.saveProgramData(
            body.instId,
            body.instType,
            file.buffer,
            validationToken
        );
    }
}