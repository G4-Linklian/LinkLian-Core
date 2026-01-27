// file-storage.dto.ts
import { IsString, IsArray, IsNotEmpty, ArrayNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for delete files request
 */
export class DeleteFilesDto {
  @ApiProperty({ 
    description: 'Array of file names/paths to delete', 
    example: ['folder/uuid-filename.jpg', 'folder/uuid-filename2.pdf'],
    type: [String]
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  fileNames: string[];
}

/**
 * Response interface for uploaded file
 */
export interface UploadedFileResponse {
  originalName: string;
  fileType: string;
  fileName: string;
  fileUrl: string;
}

/**
 * Response interface for upload result
 */
export interface UploadResultResponse {
  success: boolean;
  message: string;
  uploadedCount: number;
  container: string;
  folder: string;
  files: UploadedFileResponse[];
}

/**
 * Response interface for delete result
 */
export interface DeleteResultResponse {
  success: boolean;
  message: string;
  container: string;
  deletedCount: {
    successfulDeletes: number;
    failedDeletes: number;
  };
  files: PromiseSettledResult<{ fileName: string; fileUrl: string }>[];
}
