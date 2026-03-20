// post-comment.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostCommentController } from './post-comment.controller';
import { PostCommentService } from './post-comment.service';
import { PostComment } from './entities/post-comment.entity';
import { PostCommentPath } from './entities/post-comment-path.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PostComment, PostCommentPath])],
  controllers: [PostCommentController],
  providers: [PostCommentService],
  exports: [PostCommentService],
})
export class PostCommentModule {}
