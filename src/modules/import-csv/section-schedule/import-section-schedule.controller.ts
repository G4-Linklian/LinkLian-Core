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
import { ImportSectionScheduleService } from './import-section-schedule.service';
import { ImportSectionReqDto } from './dto/import-section-schedule.dto';

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
    }
    validationToken?: string | null;
}

@ApiTags('Import Section Schedule')
@Controller('import-section-schedule')
export class ImportSectionScheduleController {
    constructor(private readonly importSectionScheduleService: ImportSectionScheduleService) {}

    @Post('validate')
    @ApiOperation({ summary: 'Validate section schedule data from Excel file' })
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
                semesterId: {
                    type: 'integer',
                    description: 'ID ของ semester',
                    example: 1
                }
            },
            required: ['file', 'instId', 'semesterId']
        },
    })
    @ApiResponse({ status: 200, description: 'Validation result with errors and valid data' })
    @ApiResponse({ status: 400, description: 'Invalid file or missing header' })
    @UseInterceptors(FileInterceptor('file'))
    async validateSectionScheduleImport(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: ImportSectionReqDto,
    ) {
        if (!file) throw new BadRequestException('No file uploaded');

        return this.importSectionScheduleService.validateSectionScheduleData(
            body.instId,
            body.semesterId,
            file.buffer
        );
    }

    @Post('save')
    @ApiOperation({ summary: 'Save validated section schedule data to database' })
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
                semesterId: {
                    type: 'integer',
                    description: 'ID ของ semester',
                    example: 1
                },
                validationToken: {
                    type: 'string',
                    description: 'Token ที่ได้จาก validate endpoint'
                }
            },
            required: ['file', 'instId', 'semesterId', 'validationToken']
        },
    })
    @ApiResponse({ status: 200, description: 'Successfully saved section schedule data' })
    @ApiResponse({ status: 400, description: 'Invalid file, missing header, or validation error' })
    @ApiResponse({ status: 401, description: 'Invalid or expired validation token' })
    @ApiResponse({ status: 500, description: 'Save failed' })
    @UseInterceptors(FileInterceptor('file'))
    async saveSectionScheduleData(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: ImportSectionReqDto,
        @Body('validationToken') validationToken: string
    ) {
        if (!file) throw new BadRequestException('No file uploaded');

        return this.importSectionScheduleService.saveSectionScheduleData(
            body.instId,
            body.semesterId,
            file.buffer,
            validationToken
        );
    }
}