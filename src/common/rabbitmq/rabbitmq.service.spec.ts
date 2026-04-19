import { Test, TestingModule } from '@nestjs/testing';
import { RabbitMQService } from './rabbitmq.service';
import { AppLogger } from 'src/common/logger/app-logger.service';

const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// ─── amqplib mock ──────────────────────────────────────────────────────────────
// jest.mock factory runs before variable initialization, so we define the mock
// objects *inside* the factory and expose them via a getter.

const mockChannel = {
  assertExchange: jest.fn().mockResolvedValue(undefined),
  assertQueue: jest.fn().mockResolvedValue(undefined),
  bindQueue: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn().mockReturnValue(true),
  consume: jest.fn().mockResolvedValue(undefined),
  prefetch: jest.fn().mockResolvedValue(undefined),
  ack: jest.fn(),
  nack: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockConnection = {
  createChannel: jest.fn().mockResolvedValue(mockChannel),
  close: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

jest.mock('amqplib', () => {
  return {
    connect: jest.fn().mockImplementation(() => Promise.resolve(mockConnection)),
  };
});

describe('RabbitMQService', () => {
  let service: RabbitMQService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockChannel.assertExchange.mockResolvedValue(undefined);
    mockChannel.assertQueue.mockResolvedValue(undefined);
    mockChannel.bindQueue.mockResolvedValue(undefined);
    mockChannel.publish.mockReturnValue(true);
    mockChannel.consume.mockResolvedValue(undefined);
    mockChannel.prefetch.mockResolvedValue(undefined);
    mockChannel.close.mockResolvedValue(undefined);
    mockConnection.createChannel.mockResolvedValue(mockChannel);
    mockConnection.close.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RabbitMQService,
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<RabbitMQService>(RabbitMQService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  // ─── publish ────────────────────────────────────────────────────────────────

  describe('publish', () => {
    it('should publish message to exchange with routing key', async () => {
      await service.publish('linklian_events', 'chat.message', { text: 'hello' });

      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'linklian_events',
        'topic',
        { durable: true },
      );
      expect(mockChannel.publish).toHaveBeenCalledWith(
        'linklian_events',
        'chat.message',
        expect.any(Buffer),
        { persistent: true },
      );
    });

    it('should serialize message to JSON buffer', async () => {
      const message = { type: 'TEST', data: 123 };
      await service.publish('exchange', 'key', message);

      const buffer: Buffer = mockChannel.publish.mock.calls[0][2];
      expect(JSON.parse(buffer.toString())).toEqual(message);
    });

    it('should throw if publish channel is not available', async () => {
      await service.onModuleDestroy();

      await expect(
        service.publish('exchange', 'key', {}),
      ).rejects.toThrow('RabbitMQ publish channel is not available');
    });

    it('should use durable=false when option provided', async () => {
      await service.publish('exchange', 'key', {}, { durable: false });

      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'exchange',
        'topic',
        { durable: false },
      );
    });
  });

  // ─── consume ────────────────────────────────────────────────────────────────

  describe('consume', () => {
    it('should assert exchange, queue and bind before consuming', async () => {
      await service.consume('exchange', 'my_queue', 'routing.key', jest.fn());

      expect(mockChannel.assertExchange).toHaveBeenCalledWith('exchange', 'topic', { durable: true });
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('my_queue', { durable: true });
      expect(mockChannel.bindQueue).toHaveBeenCalledWith('my_queue', 'exchange', 'routing.key');
      expect(mockChannel.consume).toHaveBeenCalledWith('my_queue', expect.any(Function));
    });

    it('should throw if consume channel is not available', async () => {
      await service.onModuleDestroy();

      await expect(
        service.consume('exchange', 'queue', 'key', jest.fn()),
      ).rejects.toThrow('RabbitMQ consume channel is not available');
    });

    it('should ack message when handler succeeds', async () => {
      let capturedConsumer: ((msg: any) => Promise<void>) | null = null;
      mockChannel.consume.mockImplementationOnce((_queue: string, fn: any) => {
        capturedConsumer = fn;
        return Promise.resolve();
      });

      const handler = jest.fn().mockResolvedValue(undefined);
      await service.consume('exchange', 'queue', 'key', handler);

      const mockMsg = { content: Buffer.from(JSON.stringify({ data: 1 })) };
      await capturedConsumer!(mockMsg);

      expect(handler).toHaveBeenCalledWith({ data: 1 });
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });

    it('should nack (no requeue) when handler throws', async () => {
      let capturedConsumer: ((msg: any) => Promise<void>) | null = null;
      mockChannel.consume.mockImplementationOnce((_queue: string, fn: any) => {
        capturedConsumer = fn;
        return Promise.resolve();
      });

      const handler = jest.fn().mockRejectedValue(new Error('handler error'));
      await service.consume('exchange', 'queue', 'key', handler);

      const mockMsg = { content: Buffer.from(JSON.stringify({})) };
      await capturedConsumer!(mockMsg);

      expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false);
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });

    it('should ignore null messages', async () => {
      let capturedConsumer: ((msg: any) => Promise<void>) | null = null;
      mockChannel.consume.mockImplementationOnce((_queue: string, fn: any) => {
        capturedConsumer = fn;
        return Promise.resolve();
      });

      const handler = jest.fn();
      await service.consume('exchange', 'queue', 'key', handler);

      await capturedConsumer!(null);

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
