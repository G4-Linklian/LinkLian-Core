// file-storage.service.ts
import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { blobServiceClient } from '../../config/blob.config';
import { UploadedFileResponse, UploadResultResponse, DeleteResultResponse } from './dto/file-storage.dto';

@Injectable()
export class FileStorageService {
  /**
   * Upload multiple files to Azure Blob Storage
   * @param containerName - The name of the blob container
   * @param folderName - The folder path within the container
   * @param files - Array of files to upload (from multer)
   * @returns Upload result with file URLs
   */
  async uploadFiles(
    containerName: string,
    folderName: string,
    files: Express.Multer.File[]
  ): Promise<UploadResultResponse> {
    // Validate container and folder names
    if (!containerName || !folderName) {
      throw new BadRequestException('containerName or folderName missing');
    }

    // Validate files array
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    try {
      // Get container client
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const containerExists = await containerClient.exists();

      if (!containerExists) {
        throw new NotFoundException('Container does not exist');
      }

      // Set container access policy to blob level (public read for blobs)
      await containerClient.setAccessPolicy('blob');

      // Upload all files in parallel
      console.log(`[FileStorage] Uploading ${files.length} files to ${containerName}/${folderName}`);
      
      const uploadPromises = files.map(async (file): Promise<UploadedFileResponse> => {
        // Extract file extension from original name
        const fileExtension = file.originalname.split('.').pop();
        
        // Generate unique blob name with UUID
        const blobName = `${folderName}/${uuidv4()}.${fileExtension}`;
        
        console.log(`[FileStorage] Uploading file:`, {
          originalName: file.originalname,
          blobName: blobName,
          size: file.size,
          mimetype: file.mimetype
        });
        
        // Get block blob client
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        // Upload file buffer with content type
        await blockBlobClient.uploadData(file.buffer, {
          blobHTTPHeaders: { blobContentType: file.mimetype }
        });

        const result = {
          originalName: file.originalname,
          fileType: fileExtension || '',
          fileName: blobName,
          fileUrl: blockBlobClient.url
        };
        
        console.log(`[FileStorage] File uploaded successfully:`, result);
        
        return result;
      });

      const uploadResult = await Promise.all(uploadPromises);
      
      console.log(`[FileStorage] All files uploaded. Total: ${uploadResult.length}`);

      return {
        success: true,
        message: 'Files uploaded successfully',
        uploadedCount: uploadResult.length,
        container: containerName,
        folder: folderName,
        files: uploadResult
      };

    } catch (error) {
      // Re-throw NestJS exceptions
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      console.error('Upload failed:', error);
      throw new InternalServerErrorException('Upload failed');
    }
  }

  /**
   * Delete multiple files from Azure Blob Storage
   * @param containerName - The name of the blob container
   * @param fileNames - Array of file paths to delete
   * @returns Delete result with success/failure counts
   */
  async deleteFiles(
    containerName: string,
    fileNames: string[]
  ): Promise<DeleteResultResponse> {
    // Validate file names array
    if (!fileNames || fileNames.length === 0) {
      throw new BadRequestException('No files provided to delete');
    }

    try {
      // Get container client
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const containerExists = await containerClient.exists();

      if (!containerExists) {
        throw new NotFoundException('Container does not exist');
      }

      // Delete all files in parallel with allSettled for partial success handling
      const deletePromises = fileNames.map(async (fileName) => {
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        await blockBlobClient.delete();

        return {
          fileName: fileName,
          fileUrl: blockBlobClient.url,
        };
      });

      const deleteResult = await Promise.allSettled(deletePromises);
      
      // Count successful and failed deletions
      const successfulDeletes = deleteResult.filter(result => result.status === 'fulfilled').length;
      const failedDeletes = deleteResult.filter(result => result.status === 'rejected').length;

      return {
        success: true,
        message: 'Bulk delete operation completed',
        container: containerName,
        deletedCount: {
          successfulDeletes,
          failedDeletes
        },
        files: deleteResult
      };

    } catch (error) {
      // Re-throw NestJS exceptions
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      console.error('Delete failed:', error);
      throw new InternalServerErrorException('Delete failed');
    }
  }

  /**
   * Get file metadata from Azure Blob Storage
   * @param containerName - The name of the blob container
   * @param fileName - The file path (blob name)
   * @returns File metadata including size
   */
  async getFileMetadata(containerName: string, fileName: string): Promise<{ size: number; contentType: string }> {
    try {
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(fileName);
      
      const properties = await blockBlobClient.getProperties();
      
      return {
        size: properties.contentLength || 0,
        contentType: properties.contentType || 'application/octet-stream'
      };
    } catch (error) {
      console.error(`[FileStorage] Error getting file metadata:`, error);
      return { size: 0, contentType: 'application/octet-stream' };
    }
  }

  /**
   * Get multiple files metadata in parallel
   * @param containerName - The name of the blob container
   * @param fileNames - Array of file paths
   * @returns Array of file metadata
   */
  async getMultipleFileMetadata(
    containerName: string, 
    fileNames: string[]
  ): Promise<Array<{ fileName: string; size: number; contentType: string }>> {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    const metadataPromises = fileNames.map(async (fileName) => {
      try {
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        const properties = await blockBlobClient.getProperties();
        
        return {
          fileName,
          size: properties.contentLength || 0,
          contentType: properties.contentType || 'application/octet-stream'
        };
      } catch (error) {
        console.error(`[FileStorage] Error getting metadata for ${fileName}:`, error);
        return {
          fileName,
          size: 0,
          contentType: 'application/octet-stream'
        };
      }
    });
    
    return Promise.all(metadataPromises);
  }
}
