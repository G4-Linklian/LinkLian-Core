// export class CommunityModule {}
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileStorageModule } from '../file-storage/file-storage.module';

// core
import { CommunityController } from './core/community.controller';
import { CommunityService } from './core/community.service';
import { CommunityEntity } from './core/entities/community.entity';

// member
import { CommunityMemberController } from './member/community-member.controller';
import { CommunityMemberService } from './member/community-member.service';
import { CommunityMemberEntity } from './member/entities/community-member.entity';

// post
import { CommunityPostController } from './post/community-post.controller';
import { CommunityPostService } from './post/community-post.service';
import { CommunityPostEntity } from './post/entities/community-post.entity';

// comment
import { CommunityCommentController } from './comment/community-comment.controller';
import { CommunityCommentService } from './comment/community-comment.service';
import { CommunityComment } from './comment/entities/community-comment.entity';
import { CommunityCommentPath } from './comment/entities/community-comment-path.entity';
// bookmark
import { CommunityBookmarkController } from './bookmark/community-bookmark.controller';
import { CommunityBookmarkService } from './bookmark/community-bookmark.service';
import { CommunityBookmarkEntity } from './bookmark/entities/community-bookmark.entity';
import { CommunityTagNormalizeEntity } from './core/entities/community-tag-normalize.entity';
import { CommunityTagEntity } from './core/entities/community-tag.entity';
import { CommunityAttachmentEntity } from './post/entities/community-attachment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommunityEntity,
      CommunityMemberEntity,
      CommunityPostEntity,
      CommunityComment,
      CommunityCommentPath,
      CommunityBookmarkEntity,
      CommunityTagEntity,
      CommunityTagNormalizeEntity,
      CommunityAttachmentEntity,
    ]),
    FileStorageModule,
  ],

  controllers: [
    CommunityController,
    CommunityMemberController,
    CommunityPostController,
    CommunityCommentController,
    CommunityBookmarkController,
  ],

  providers: [
    CommunityService,
    CommunityMemberService,
    CommunityPostService,
    CommunityCommentService,
    CommunityBookmarkService,
  ],

  exports: [
    CommunityService,
    CommunityMemberService,
    CommunityPostService,
    CommunityCommentService,
    CommunityBookmarkService,
  ],
})
export class CommunityModule {}
