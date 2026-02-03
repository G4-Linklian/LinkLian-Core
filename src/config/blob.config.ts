// blob.config.ts
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import * as dotenv from 'dotenv';

// Ensure dotenv is loaded
dotenv.config();

/**
 * Azure Blob Service Client configuration
 * Uses account name and account key from environment variables
 */
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME || '';
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY || '';

// Debug log to verify env vars are loaded
console.log('🔧 Azure Storage Account Name:', accountName ? `${accountName.substring(0, 5)}...` : 'NOT SET');

if (!accountName || !accountKey) {
  console.error('❌ Azure Storage credentials not configured!');
  console.error('   AZURE_STORAGE_ACCOUNT_NAME:', accountName ? 'SET' : 'MISSING');
  console.error('   AZURE_STORAGE_ACCOUNT_KEY:', accountKey ? 'SET' : 'MISSING');
}

// Create SharedKeyCredential
const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

// Create BlobServiceClient with account URL and credential
export const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  sharedKeyCredential
);
