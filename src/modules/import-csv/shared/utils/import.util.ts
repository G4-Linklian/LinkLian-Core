import * as crypto from 'crypto';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ImportValidationPayload } from '../interfaces';

export function calculateDataHash(data: any[]): string {
  const dataString = JSON.stringify(data);
  return crypto.createHash('sha256').update(dataString).digest('hex');
}

export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function processBatchesParallel<T, R>(
  batches: T[][],
  processor: (batch: T[]) => Promise<R[]>,
  maxConcurrent: number,
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < batches.length; i += maxConcurrent) {
    const currentBatches = batches.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      currentBatches.map((batch) => processor(batch)),
    );
    results.push(...batchResults.flat());
  }

  return results;
}

export function createValidationToken(
  jwtService: JwtService,
  payload: Omit<ImportValidationPayload, 'timestamp'>,
  expiresIn: string = '30m',
): string {
  return jwtService.sign(
    {
      ...payload,
      timestamp: Date.now(),
    } as Record<string, any>,
    { expiresIn } as JwtSignOptions,
  );
}

export function verifyValidationToken(
  jwtService: JwtService,
  validationToken: string,
  expectedType: ImportValidationPayload['type'],
  instId: number,
  rawData: any[],
): ImportValidationPayload {
  try {
    const payload = jwtService.verify<ImportValidationPayload>(validationToken);

    if (payload.type !== expectedType) {
      throw new UnauthorizedException(
        `Token ไม่ใช่สำหรับนำเข้าข้อมูล${getTypeLabel(expectedType)}`,
      );
    }

    if (payload.instId !== instId) {
      throw new UnauthorizedException('Token ไม่ตรงกับสถาบันที่ระบุ');
    }

    const currentDataHash = calculateDataHash(rawData);
    if (payload.dataHash !== currentDataHash) {
      throw new BadRequestException(
        'ข้อมูลถูกเปลี่ยนแปลงหลังจาก validate กรุณา validate ใหม่',
      );
    }

    return payload;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedException('Token หมดอายุ กรุณา validate ใหม่');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new UnauthorizedException('Token ไม่ถูกต้อง');
    }
    throw error;
  }
}

function getTypeLabel(type: ImportValidationPayload['type']): string {
  const labels: Record<ImportValidationPayload['type'], string> = {
    student: 'นักเรียน',
    teacher: 'บุคลากร',
    subject: 'วิชา',
    program: 'แผนการเรียน',
    enrollment: 'ลงทะเบียน',
    'section-schedule': 'ตารางสอน',
  };
  return labels[type] || type;
}
