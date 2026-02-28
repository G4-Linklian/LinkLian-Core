// file-storage.controller.ts
import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Get,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { FileStorageService } from './file-storage.service';
import { DeleteFilesDto } from './dto/file-storage.dto';

@ApiTags('FileStorage')
@Controller()
export class FileStorageController {
  constructor(private readonly fileStorageService: FileStorageService) {}

  /**
   * Upload files for social-feed (Flutter compatible)
   */
  @Post('uploadFile/social-feed/fileattachment')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({
    summary: 'Upload files for social feed posts (Flutter compatible)',
  })
  @ApiConsumes('multipart/form-data')
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
  @ApiResponse({ status: 400, description: 'No files uploaded' })
  @ApiResponse({ status: 500, description: 'Upload failed' })
  async uploadSocialFeedFiles(@UploadedFiles() files: Express.Multer.File[]) {
    // Use 'social-feed' as container and 'fileattachment' as folder
    return this.fileStorageService.uploadFiles(
      'social-feed',
      'fileattachment',
      files,
    );
  }

  /**
   * Upload avatar for user profile (Flutter compatible)
   */
  @Post('uploadFile/user/profile-upload')
  @UseInterceptors(FilesInterceptor('files', 1))
  @ApiOperation({
    summary: 'Upload avatar for user profile (Flutter compatible)',
  })
  @ApiConsumes('multipart/form-data')
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
  @ApiResponse({ status: 200, description: 'Avatar uploaded successfully' })
  @ApiResponse({ status: 400, description: 'No file uploaded' })
  @ApiResponse({ status: 500, description: 'Upload failed' })
  async uploadAvatar(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No file uploaded');
    }

    // Use 'user' as container and 'avatar' as folder
    return this.fileStorageService.uploadFiles('user', 'avatar', files);
  }

  /**
   * Delete files for user profile (Flutter compatible)
   */
  @Delete('deleteFile/user')
  @ApiOperation({
    summary: 'Delete files from user profile (Flutter compatible)',
  })
  @ApiResponse({ status: 200, description: 'Files deleted successfully' })
  @ApiResponse({ status: 400, description: 'No files provided' })
  async deleteUserFiles(@Body() dto: DeleteFilesDto) {
    return this.fileStorageService.deleteFiles('user', dto.fileNames);
  }

  /**
   * Delete files for social-feed (Flutter compatible)
   */
  @Delete('deleteFile/social-feed')
  @ApiOperation({
    summary: 'Delete files from social feed (Flutter compatible)',
  })
  @ApiResponse({ status: 200, description: 'Files deleted successfully' })
  @ApiResponse({ status: 400, description: 'No files provided' })
  async deleteSocialFeedFiles(@Body() dto: DeleteFilesDto) {
    return this.fileStorageService.deleteFiles('social-feed', dto.fileNames);
  }

  /**
   * Upload multiple files to Azure Blob Storage
   */
  @Post('file-storage/upload/:containerName/:folderName')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({ summary: 'Upload multiple files to Azure Blob Storage' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'containerName',
    description: 'Azure Blob container name',
    example: 'smartgis',
  })
  @ApiParam({
    name: 'folderName',
    description: 'Folder path within container',
    example: 'documents',
  })
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
  @ApiResponse({
    status: 400,
    description: 'Invalid request - missing container/folder or no files',
  })
  @ApiResponse({ status: 404, description: 'Container does not exist' })
  @ApiResponse({ status: 500, description: 'Upload failed' })
  async uploadFiles(
    @Param('containerName') containerName: string,
    @Param('folderName') folderName: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.fileStorageService.uploadFiles(
      containerName,
      folderName,
      files,
    );
  }

  /**
   * Delete multiple files from Azure Blob Storage
   */
  @Delete('file-storage/:containerName')
  @ApiOperation({ summary: 'Delete multiple files from Azure Blob Storage' })
  @ApiParam({
    name: 'containerName',
    description: 'Azure Blob container name',
    example: 'smartgis',
  })
  @ApiResponse({ status: 200, description: 'Bulk delete operation completed' })
  @ApiResponse({ status: 400, description: 'No files provided to delete' })
  @ApiResponse({ status: 404, description: 'Container does not exist' })
  @ApiResponse({ status: 500, description: 'Delete failed' })
  async deleteFiles(
    @Param('containerName') containerName: string,
    @Body() dto: DeleteFilesDto,
  ) {
    return this.fileStorageService.deleteFiles(containerName, dto.fileNames);
  }

  /**
   * Get file metadata (size, content type)
   */
  @Get('file-storage/metadata/:containerName')
  @ApiOperation({ summary: 'Get metadata for multiple files' })
  @ApiParam({ name: 'containerName', description: 'Azure Blob container name' })
  @ApiResponse({
    status: 200,
    description: 'File metadata retrieved successfully',
  })
  async getFileMetadata(
    @Param('containerName') containerName: string,
    @Body() body: { fileNames: string[] },
  ) {
    return this.fileStorageService.getMultipleFileMetadata(
      containerName,
      body.fileNames,
    );
  }
}
