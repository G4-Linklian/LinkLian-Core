// file-storage.controller.ts
import { 
  Controller, 
  Post, 
  Delete, 
  Body, 
  Param, 
  UseInterceptors, 
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiParam, ApiBody } from '@nestjs/swagger';
import { FileStorageService } from './file-storage.service';
import { DeleteFilesDto } from './dto/file-storage.dto';

@ApiTags('FileStorage')
@Controller('file-storage')
export class FileStorageController {
  constructor(private readonly fileStorageService: FileStorageService) {}

  /**
   * Upload multiple files to Azure Blob Storage
   */
  @Post('upload/:containerName/:folderName')
  @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
  @ApiOperation({ summary: 'Upload multiple files to Azure Blob Storage' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'containerName', description: 'Azure Blob container name', example: 'smartgis' })
  @ApiParam({ name: 'folderName', description: 'Folder path within container', example: 'documents' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Files uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request - missing container/folder or no files' })
  @ApiResponse({ status: 404, description: 'Container does not exist' })
  @ApiResponse({ status: 500, description: 'Upload failed' })
  async uploadFiles(
    @Param('containerName') containerName: string,
    @Param('folderName') folderName: string,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    return this.fileStorageService.uploadFiles(containerName, folderName, files);
  }

  /**
   * Delete multiple files from Azure Blob Storage
   */
  @Delete(':containerName')
  @ApiOperation({ summary: 'Delete multiple files from Azure Blob Storage' })
  @ApiParam({ name: 'containerName', description: 'Azure Blob container name', example: 'smartgis' })
  @ApiResponse({ status: 200, description: 'Bulk delete operation completed' })
  @ApiResponse({ status: 400, description: 'No files provided to delete' })
  @ApiResponse({ status: 404, description: 'Container does not exist' })
  @ApiResponse({ status: 500, description: 'Delete failed' })
  async deleteFiles(
    @Param('containerName') containerName: string,
    @Body() dto: DeleteFilesDto
  ) {
    return this.fileStorageService.deleteFiles(containerName, dto.fileNames);
  }
}
