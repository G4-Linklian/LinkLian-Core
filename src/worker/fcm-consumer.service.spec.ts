import { Test, TestingModule } from '@nestjs/testing';
import { FCMConsumerService } from './fcm-consumer.service';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { DataSource } from 'typeorm';
import { AppLogger } from '../common/logger/app-logger.service';

jest.mock('./utils/fcm.utils', () => ({
  sendFCMInBatches: jest.fn().mockResolvedValue(undefined),
}));

import { sendFCMInBatches } from './utils/fcm.utils';

const mockConsume = jest.fn();
const mockRabbitMQ = { consume: mockConsume };
const mockDataSource = { query: jest.fn() };
const mockLogger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

describe('FCMConsumerService', () => {
  let service: FCMConsumerService;
  let capturedHandler: ((msg: any) => Promise<void>) | null = null;

  beforeEach(async () => {
    jest.clearAllMocks();
    capturedHandler = null;

    mockConsume.mockImplementation((_exchange, _queue, _key, handler) => {
      capturedHandler = handler;
      return Promise.resolve();
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FCMConsumerService,
        { provide: RabbitMQService, useValue: mockRabbitMQ },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<FCMConsumerService>(FCMConsumerService);
    await service.onModuleInit();
  });

  describe('onModuleInit', () => {
    it('should register consumer on firebase_events queue', () => {
      expect(mockConsume).toHaveBeenCalledWith(
        expect.any(String),        // exchange
        'firebase_events',          // queue
        expect.any(String),        // routing key
        expect.any(Function),      // handler
      );
    });
  });

  describe('handleFCMSend', () => {
    it('should call sendFCMInBatches with parsed receiverId for FCM_SEND message', async () => {
      const msg = {
        type: 'FCM_SEND',
        payload: {
          receive_user_id: '42',
          title: 'Test',
          body: 'Hello',
        },
      };

      await capturedHandler!(msg);

      expect(sendFCMInBatches).toHaveBeenCalledWith(
        mockDataSource,
        [42],
        msg.payload,
      );
    });

    it('should skip message if type is not FCM_SEND', async () => {
      const msg = { type: 'UNKNOWN', payload: { receive_user_id: '1' } };

      await capturedHandler!(msg);

      expect(sendFCMInBatches).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should skip message if receive_user_id is not a valid number', async () => {
      const msg = {
        type: 'FCM_SEND',
        payload: { receive_user_id: 'not-a-number' },
      };

      await capturedHandler!(msg);

      expect(sendFCMInBatches).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
