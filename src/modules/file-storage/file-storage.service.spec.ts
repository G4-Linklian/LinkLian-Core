import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { FileStorageService } from './file-storage.service';
import { AppLogger } from '../../common/logger/app-logger.service';

// ─── Mock Azure Blob Storage ──────────────────────────────────────────────────

const mockBlockBlobClient = {
  url: 'https://storage.blob.core.windows.net/container/folder/file.jpg',
  uploadData: jest.fn(),
  delete: jest.fn(),
  getProperties: jest.fn(),
};

const mockContainerClient = {
  exists: jest.fn(),
  setAccessPolicy: jest.fn(),
  getBlockBlobClient: jest.fn().mockReturnValue(mockBlockBlobClient),
};

const mockBlobServiceClient = {
  getContainerClient: jest.fn().mockReturnValue(mockContainerClient),
};

jest.mock('../../config/blob.config', () => ({
  blobServiceClient: {
    getContainerClient: jest.fn(),
  },
}));

// Import after mock so we can control it
import { blobServiceClient } from '../../config/blob.config';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
  ({
    originalname: 'test-image.jpg',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-file-content'),
    size: 1234,
    fieldname: 'file',
    encoding: '7bit',
    ...overrides,
  }) as Express.Multer.File;

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('FileStorageService', () => {
  let service: FileStorageService;

  const mockLogger: Partial<AppLogger> = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileStorageService,
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<FileStorageService>(FileStorageService);

    // Wire up mock blob client
    (blobServiceClient.getContainerClient as jest.Mock).mockReturnValue(
      mockContainerClient,
    );
    mockContainerClient.exists.mockResolvedValue(true);
    mockContainerClient.setAccessPolicy.mockResolvedValue(undefined);
    mockContainerClient.getBlockBlobClient.mockReturnValue(mockBlockBlobClient);
    mockBlockBlobClient.uploadData.mockResolvedValue(undefined);
    mockBlockBlobClient.delete.mockResolvedValue(undefined);
    mockBlockBlobClient.getProperties.mockResolvedValue({
      contentLength: 2048,
      contentType: 'image/jpeg',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── uploadFiles ───────────────────────────────────────────────────────────

  describe('uploadFiles', () => {
    it('should throw BadRequestException when containerName is missing', async () => {
      await expect(
        service.uploadFiles('', 'folder', [mockFile()]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when folderName is missing', async () => {
      await expect(
        service.uploadFiles('container', '', [mockFile()]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when files array is empty', async () => {
      await expect(
        service.uploadFiles('container', 'folder', []),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when files is null/undefined', async () => {
      await expect(
        service.uploadFiles('container', 'folder', null as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when container does not exist', async () => {
      mockContainerClient.exists.mockResolvedValue(false);

      await expect(
        service.uploadFiles('container', 'folder', [mockFile()]),
      ).rejects.toThrow(NotFoundException);
    });

    it('should upload single file and return correct response shape', async () => {
      const result = await service.uploadFiles('container', 'folder', [
        mockFile(),
      ]);

      expect(result).toMatchObject({
        success: true,
        message: 'Files uploaded successfully',
        uploadedCount: 1,
        container: 'container',
        folder: 'folder',
      });
      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toMatchObject({
        originalName: 'test-image.jpg',
        fileType: 'jpg',
        fileUrl: mockBlockBlobClient.url,
      });
    });

    it('should upload multiple files and return correct count', async () => {
      const files = [
        mockFile({ originalname: 'a.jpg' }),
        mockFile({ originalname: 'b.png' }),
        mockFile({ originalname: 'c.pdf' }),
      ];

      const result = await service.uploadFiles('container', 'folder', files);

      expect(result.uploadedCount).toBe(3);
      expect(result.files).toHaveLength(3);
      expect(mockBlockBlobClient.uploadData).toHaveBeenCalledTimes(3);
    });

    it('should call setAccessPolicy with "blob" on container', async () => {
      await service.uploadFiles('container', 'folder', [mockFile()]);

      expect(mockContainerClient.setAccessPolicy).toHaveBeenCalledWith('blob');
    });

    it('should call uploadData with correct buffer and content type', async () => {
      const file = mockFile({ mimetype: 'image/png' });
      await service.uploadFiles('container', 'folder', [file]);

      expect(mockBlockBlobClient.uploadData).toHaveBeenCalledWith(
        file.buffer,
        expect.objectContaining({
          blobHTTPHeaders: { blobContentType: 'image/png' },
        }),
      );
    });

    it('should throw InternalServerErrorException on unexpected upload error', async () => {
      mockBlockBlobClient.uploadData.mockRejectedValue(new Error('Azure error'));

      await expect(
        service.uploadFiles('container', 'folder', [mockFile()]),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── deleteFiles ───────────────────────────────────────────────────────────

  describe('deleteFiles', () => {
    it('should throw BadRequestException when fileNames is empty', async () => {
      await expect(
        service.deleteFiles('container', []),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when fileNames is null/undefined', async () => {
      await expect(
        service.deleteFiles('container', null as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when container does not exist', async () => {
      mockContainerClient.exists.mockResolvedValue(false);

      await expect(
        service.deleteFiles('container', ['folder/file.jpg']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete files and return correct response shape', async () => {
      const result = await service.deleteFiles('container', [
        'folder/file1.jpg',
        'folder/file2.jpg',
      ]);

      expect(result).toMatchObject({
        success: true,
        message: 'Bulk delete operation completed',
        container: 'container',
      });
      expect(result.deletedCount.successfulDeletes).toBe(2);
      expect(result.deletedCount.failedDeletes).toBe(0);
    });

    it('should count partial failures correctly when some deletes fail', async () => {
      mockBlockBlobClient.delete
        .mockResolvedValueOnce(undefined) // first file succeeds
        .mockRejectedValueOnce(new Error('Not found')) // second file fails
        .mockResolvedValueOnce(undefined); // third file succeeds

      const result = await service.deleteFiles('container', [
        'file1.jpg',
        'file2.jpg',
        'file3.jpg',
      ]);

      expect(result.deletedCount.successfulDeletes).toBe(2);
      expect(result.deletedCount.failedDeletes).toBe(1);
      expect(result.files).toHaveLength(3);
    });

    it('should return success even when all deletes fail (allSettled)', async () => {
      mockBlockBlobClient.delete.mockRejectedValue(new Error('Not found'));

      const result = await service.deleteFiles('container', [
        'file1.jpg',
        'file2.jpg',
      ]);

      expect(result.success).toBe(true);
      expect(result.deletedCount.successfulDeletes).toBe(0);
      expect(result.deletedCount.failedDeletes).toBe(2);
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      mockContainerClient.exists.mockRejectedValue(new Error('Azure error'));

      await expect(
        service.deleteFiles('container', ['file.jpg']),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── getFileMetadata ───────────────────────────────────────────────────────

  describe('getFileMetadata', () => {
    it('should return file size and contentType on success', async () => {
      const result = await service.getFileMetadata('container', 'folder/file.jpg');

      expect(result).toEqual({ size: 2048, contentType: 'image/jpeg' });
      expect(mockBlockBlobClient.getProperties).toHaveBeenCalled();
    });

    it('should return default values when getProperties fails', async () => {
      mockBlockBlobClient.getProperties.mockRejectedValue(
        new Error('Blob not found'),
      );

      const result = await service.getFileMetadata('container', 'folder/missing.jpg');

      expect(result).toEqual({ size: 0, contentType: 'application/octet-stream' });
    });

    it('should return size=0 when contentLength is undefined', async () => {
      mockBlockBlobClient.getProperties.mockResolvedValue({
        contentLength: undefined,
        contentType: 'image/png',
      });

      const result = await service.getFileMetadata('container', 'folder/file.png');

      expect(result.size).toBe(0);
      expect(result.contentType).toBe('image/png');
    });

    it('should return default contentType when contentType is undefined', async () => {
      mockBlockBlobClient.getProperties.mockResolvedValue({
        contentLength: 512,
        contentType: undefined,
      });

      const result = await service.getFileMetadata('container', 'folder/file');

      expect(result.contentType).toBe('application/octet-stream');
      expect(result.size).toBe(512);
    });
  });

  // ─── getMultipleFileMetadata ───────────────────────────────────────────────

  describe('getMultipleFileMetadata', () => {
    it('should return metadata for all files', async () => {
      const result = await service.getMultipleFileMetadata('container', [
        'file1.jpg',
        'file2.png',
      ]);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        fileName: 'file1.jpg',
        size: 2048,
        contentType: 'image/jpeg',
      });
    });

    it('should return default values for files that fail', async () => {
      mockBlockBlobClient.getProperties
        .mockResolvedValueOnce({ contentLength: 1024, contentType: 'image/jpeg' })
        .mockRejectedValueOnce(new Error('Blob not found'));

      const result = await service.getMultipleFileMetadata('container', [
        'file1.jpg',
        'missing.jpg',
      ]);

      expect(result[0]).toMatchObject({ fileName: 'file1.jpg', size: 1024 });
      expect(result[1]).toMatchObject({
        fileName: 'missing.jpg',
        size: 0,
        contentType: 'application/octet-stream',
      });
    });

    it('should return empty array when no fileNames provided', async () => {
      const result = await service.getMultipleFileMetadata('container', []);

      expect(result).toEqual([]);
    });

    it('should process all files in parallel and return correct length', async () => {
      const fileNames = ['a.jpg', 'b.jpg', 'c.jpg'];

      const result = await service.getMultipleFileMetadata('container', fileNames);

      expect(result).toHaveLength(3);
      expect(mockBlockBlobClient.getProperties).toHaveBeenCalledTimes(3);
    });
  });
});