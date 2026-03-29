// chat.service.ts
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Chat } from './entities/chat.entity';
import { Message } from './entities/message.entity';
import { UserSysChatNormalize } from './entities/user-sys-chat-normalize.entity';
import {
  CreateChatDto,
  SearchChatDto,
  CreateMessageDto,
  SearchMessageDto,
  ChatSendEvent,
  SearchUserForChatDto,
} from './dto/chat.dto';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { RabbitMQService } from 'src/common/rabbitmq/rabbitmq.service';
import { FileStorageService } from 'src/modules/file-storage/file-storage.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat)
    private chatRepo: Repository<Chat>,
    @InjectRepository(Message)
    private messageRepo: Repository<Message>,
    @InjectRepository(UserSysChatNormalize)
    private userSysChatNormalizeRepo: Repository<UserSysChatNormalize>,
    private dataSource: DataSource,
    private readonly logger: AppLogger,
    private readonly rabbitMQService: RabbitMQService,
    private readonly fileStorageService: FileStorageService,
  ) { }

  private async ensureActiveUser(userId: number) {
    const user = await this.dataSource.query(
      `
      SELECT 1
      FROM user_sys
      WHERE user_sys_id = $1
      `,
      [userId],
    );

    if (!user.length) {
      throw new ForbiddenException('Account deleted');
    }
  }

  // ========== Chat Methods ==========

  /**
   * Find chat by ID
   */
  async findChatById(id: number) {
    const chat = await this.chatRepo.findOne({
      where: { chat_id: id },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    return { success: true, data: chat };
  }

  /**
   * Search chats with filters and joins to get user info
   */
  async searchChat(dto: SearchChatDto) {
    // Validate that at least one search parameter is provided
    const hasInput =
      dto.chat_id ||
      dto.user_sys_id ||
      typeof dto.is_ai_chat === 'boolean' ||
      typeof dto.flag_valid === 'boolean';

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    // Build raw query for complex joins
    let query = `
      SELECT DISTINCT ON (c.chat_id)
      c.*, 
      COALESCE(us.first_name, '') as first_name,
      COALESCE(us.last_name, '') as last_name,
      us.profile_pic
      FROM chat c
      LEFT JOIN user_sys_chat_normalize uscn 
      ON c.chat_id = uscn.chat_id
      AND uscn.user_sys_id <> $1
      LEFT JOIN user_sys us ON uscn.user_sys_id = us.user_sys_id
      WHERE 1=1
    `;

    const values: any[] = [];
    let index = 1;

    if (dto.chat_id) {
      query += ` AND c.chat_id = $${index++}`;
      values.push(dto.chat_id);
    }

    // Filter chats that include the specified user
    if (dto.user_sys_id) {
      query += `
    AND EXISTS (
      SELECT 1
      FROM user_sys_chat_normalize uscn2
      WHERE uscn2.chat_id = c.chat_id
        AND uscn2.user_sys_id = $${index}
    )
  `;
      values.push(dto.user_sys_id);
      index++;

    }

    if (typeof dto.is_ai_chat === 'boolean') {
      query += ` AND c.is_ai_chat = $${index++}`;
      values.push(dto.is_ai_chat);
    }

    if (typeof dto.flag_valid === 'boolean') {
      query += ` AND c.flag_valid = $${index++}`;
      values.push(dto.flag_valid);
    }

    // Sort
    if (dto.sort_by) {
      const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY c.chat_id, c.${dto.sort_by} ${order}`;
    }

    // Pagination
    if (dto.limit) {
      query += ` LIMIT $${index++}`;
      values.push(dto.limit);
    }

    if (dto.offset) {
      query += ` OFFSET $${index++}`;
      values.push(dto.offset);
    }

    try {
      const result = await this.dataSource.query(query, values);
      return { success: true, data: result };
    } catch (error: unknown) {
      this.logger.error(
        'Error executing searchChat query:',
        'SearchChat',
        error,
      );
      throw new InternalServerErrorException('Error fetching chats');
    }
  }

  /**
   * Create a new chat with transaction
   * Also creates entries in user_sys_chat_normalize for both participants
   */
  async createChat(dto: CreateChatDto) {
    if (!dto.sender_id || !dto.receiver_id) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const existingChat = await this.dataSource.query(
        `
        SELECT chat_id
        FROM user_sys_chat_normalize
        WHERE user_sys_id IN ($1, $2)
        GROUP BY chat_id
        HAVING COUNT(*) = 2
        LIMIT 1
        `,
        [dto.sender_id, dto.receiver_id],
      );

      if (existingChat.length > 0) {
        const chat = await this.chatRepo.findOne({
          where: { chat_id: existingChat[0].chat_id },
        });

        this.logger.log(
          JSON.stringify({
            label: 'CreateChat',
            message: 'Chat already exists',
            sender: dto.sender_id,
            receiver: dto.receiver_id,
            chat_id: existingChat[0].chat_id,
          }),
        );

        return {
          success: true,
          message: 'Chat already exists',
          data: chat,
        };
      }
    } catch (error) {
      this.logger.error('Error checking existing chat', 'CreateChat', error);
      throw new InternalServerErrorException('Error checking existing chat');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create the chat
      const newChat = queryRunner.manager.create(Chat, {
        is_ai_chat: dto.is_ai_chat ?? false,
        flag_valid: true,
      });

      const savedChat = await queryRunner.manager.save(newChat);

      // Create normalize entries for sender
      const senderNormalize = queryRunner.manager.create(UserSysChatNormalize, {
        user_sys_id: dto.sender_id,
        chat_id: savedChat.chat_id,
        flag_valid: true,
      });
      await queryRunner.manager.save(senderNormalize);

      // Create normalize entries for receiver
      const receiverNormalize = queryRunner.manager.create(
        UserSysChatNormalize,
        {
          user_sys_id: dto.receiver_id,
          chat_id: savedChat.chat_id,
          flag_valid: true,
        },
      );
      await queryRunner.manager.save(receiverNormalize);

      // Commit transaction
      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Chat created successfully!',
        data: savedChat,
      };
    } catch (error: unknown) {
      // Rollback on error
      await queryRunner.rollbackTransaction();
      this.logger.error('Error creating chat:', 'CreateChat', error);
      throw new InternalServerErrorException('Error creating chat');
    } finally {
      await queryRunner.release();
    }
  }

  // ========== Message Methods ==========

  /**
   * Search messages with filters
   */
  async searchMessages(dto: SearchMessageDto) {
    // Validate that at least one search parameter is provided
    const hasInput =
      dto.message_id ||
      dto.chat_id ||
      dto.sender_id ||
      dto.content ||
      dto.reply_id ||
      typeof dto.flag_valid === 'boolean';

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    const query = this.messageRepo
      .createQueryBuilder('m')
      .select('m.*')
      .addSelect('COUNT(*) OVER()', 'total_count');

    if (dto.message_id) {
      query.andWhere('m.message_id = :messageId', {
        messageId: dto.message_id,
      });
    }

    if (dto.chat_id) {
      query.andWhere('m.chat_id = :chatId', { chatId: dto.chat_id });
    }

    // if (dto.sender_id) {
    //   query.andWhere('m.sender_id = :senderId', { senderId: dto.sender_id });
    // }
    if (dto.sender_id) {
      query.andWhere(
        '(m.sender_id = :senderId OR m.sender_id IS NULL)',
        { senderId: dto.sender_id }
      );
    }

    // Content search with ILIKE for case-insensitive partial match
    if (dto.content) {
      query.andWhere('m.content ILIKE :content', {
        content: `%${dto.content}%`,
      });
    }

    if (dto.reply_id) {
      query.andWhere('m.reply_id = :replyId', { replyId: dto.reply_id });
    }

    if (typeof dto.flag_valid === 'boolean') {
      query.andWhere('m.flag_valid = :flagValid', {
        flagValid: dto.flag_valid,
      });
    }

    // Sort
    if (dto.sort_by) {
      const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query.orderBy(`m.${dto.sort_by}`, order);
    }

    // Pagination
    if (dto.limit) query.limit(dto.limit);
    if (dto.offset) query.offset(dto.offset);

    try {
      const result = await query.getRawMany();
      return { success: true, data: result };
    } catch (error: unknown) {
      this.logger.error(
        'Error executing searchMessages query:',
        'SearchMessages',
        error,
      );
      throw new InternalServerErrorException('Error fetching messages');
    }
  }

  /**
   * Create a new message with transaction
   * Also updates chat's last_sent and last_messages
   * Sends event to RabbitMQ for real-time delivery
   */
  //async createMessage(dto: CreateMessageDto) {
  async createMessage(dto: CreateMessageDto, files?: Express.Multer.File[],) {
    if (!dto.chat_id || !dto.sender_id || !dto.content) {
      throw new BadRequestException('Missing required fields!');
    }

    await this.ensureActiveUser(dto.sender_id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newMessage = new Message();
      newMessage.chat_id = dto.chat_id;
      newMessage.sender_id = dto.sender_id;
      newMessage.content = dto.content;
      newMessage.reply_id = dto.reply_id || null;
      // newMessage.file = dto.file || null;
      let attachments: any[] = [];
      if (files && files.length > 0) {

        const uploadResult = await this.fileStorageService.uploadFiles(
          'chat',
          'message',
          files,
        );

        for (const uploaded of uploadResult.files) {

          attachments.push({
            url: uploaded.fileUrl,
            original_name: uploaded.originalName,
            type: uploaded.fileType,
          });

        }
      }
      newMessage.file = attachments.length ? attachments : null;
      newMessage.status = 'SENDED';
      newMessage.flag_valid = true;
      this.logger.debug(
        JSON.stringify({
          label: 'BeforeSaveFile',
          value: newMessage.file,
          type: typeof newMessage.file,
          isArray: Array.isArray(newMessage.file),
        }),
      );

      const savedMessage = await queryRunner.manager.save(newMessage);

      // Update chat's last_sent and last_messages
      await queryRunner.manager.update(
        Chat,
        { chat_id: dto.chat_id },
        {
          last_sent: new Date(),
          last_messages: dto.content ?? '',
        },
      );

      // Send event to RabbitMQ for real-time delivery
      // Must succeed before committing — failure will trigger rollback
      ///await this.sendMessageToRabbitMQ(savedMessage);
      try {
        await this.sendMessageToRabbitMQ(savedMessage);
      } catch (error) {
        this.logger.error(
          'RabbitMQ failed but message saved',
          'CreateMessage',
          error,
        );
      }

      // Commit transaction only after RabbitMQ succeeds
      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Message created successfully!',
        data: savedMessage,
      };
    } catch (error) {
      // Rollback on error
      await queryRunner.rollbackTransaction();
      this.logger.error('Error creating message:', 'CreateMessage', error);
      throw new InternalServerErrorException('Error creating message');
    } finally {
      await queryRunner.release();
    }
  }

  async searchUsersForChat(dto: SearchUserForChatDto) {

    const user = await this.dataSource.query(
      `
    SELECT role_id, inst_id
    FROM user_sys
    WHERE user_sys_id = $1
    `,
      [dto.user_sys_id],
    );

    if (!user.length) {
      throw new NotFoundException('User not found');
    }

    const currentUser = user[0];

    const roleMap: Record<number, number> = {
      2: 4,
      4: 2,
      3: 5,
      5: 3,
    };

    const targetRole = roleMap[currentUser.role_id];

    if (!targetRole) {
      throw new BadRequestException('Role not allowed');
    }

    let query = `
    SELECT 
      user_sys_id,
      first_name,
      last_name,
      profile_pic
    FROM user_sys
    WHERE inst_id = $1
    AND role_id = $2
    AND user_status = 'Active'
    AND user_sys_id <> $3
  `;

    const values: any[] = [
      currentUser.inst_id,
      targetRole,
      dto.user_sys_id,
    ];

    let paramIndex = 4;

    if (dto.keyword) {
      query += `
      AND (
        first_name ILIKE $${paramIndex}
        OR last_name ILIKE $${paramIndex}
      )
    `;
      values.push(`%${dto.keyword}%`);
      paramIndex++;
    }

    query += ` ORDER BY first_name ASC`;

    if (dto.limit) {
      query += ` LIMIT $${paramIndex}`;
      values.push(dto.limit);
      paramIndex++;
    }

    if (dto.offset) {
      query += ` OFFSET $${paramIndex}`;
      values.push(dto.offset);
    }

    const users = await this.dataSource.query(query, values);

    const usersData = {
      users: users,
    };

    return {
      success: true,
      data: usersData,
      message: 'Search users successfully',
    };
  }

  /**
   * Send message event to RabbitMQ for socket delivery
   */
  private async sendMessageToRabbitMQ(message: Message): Promise<void> {
    const eventMessage: ChatSendEvent = {
      type: 'CHAT_DELIVER',
      payload: {
        chat_id: message.chat_id,
        sender_id: message.sender_id,
        content: message.content,
        reply_id: message.reply_id ?? null,
        file_url: (message.file as object[]) ?? [],
        created_at: message.created_at,
      },
    };

    this.logger.debug(
      'Publishing message to RabbitMQ:',
      'ChatService',
      eventMessage,
    );

    await this.rabbitMQService.publish('linklian_events', 'chat.deliver', eventMessage);

    this.logger.debug('Message published to RabbitMQ successfully', 'ChatService');
  }
}
