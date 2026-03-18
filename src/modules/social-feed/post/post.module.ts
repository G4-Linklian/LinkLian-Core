// post.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { PostContent } from './entities/post-content.entity';
import { PostInClass } from './entities/post-in-class.entity';
import { PostAttachment } from './entities/post-attachment.entity';
import { FileStorageModule } from '../../file-storage/file-storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostContent, PostInClass, PostAttachment]),
    FileStorageModule,
  ],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}
