// blob.config.ts
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';

/**
 * Azure Blob Service Client configuration
 * Uses account name and account key from environment variables
 */
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME || '';
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY || '';

// Create SharedKeyCredential
const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

// Create BlobServiceClient with account URL and credential
export const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  sharedKeyCredential
);
