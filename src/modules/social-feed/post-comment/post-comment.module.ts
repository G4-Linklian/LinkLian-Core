// post-comment.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostCommentController } from './post-comment.controller';
import { PostCommentService } from './post-comment.service';
import { PostCommentNotificationService } from './post-comment-notification.service';
import { PostComment } from './entities/post-comment.entity';
import { PostCommentPath } from './entities/post-comment-path.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PostComment, PostCommentPath])],
  controllers: [PostCommentController],
  providers: [PostCommentService, PostCommentNotificationService],
  exports: [PostCommentService],
})
export class PostCommentModule {}
