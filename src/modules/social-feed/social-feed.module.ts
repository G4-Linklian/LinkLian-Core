// social-feed.module.ts
import { Module } from '@nestjs/common';
import { FeedModule } from './feed/feed.module';
import { PostModule } from './post/post.module';
import { PostCommentModule } from './post-comment';
import { ClassInfoModule } from './class-info/class-info.module';

@Module({
  imports: [FeedModule, PostModule, PostCommentModule, ClassInfoModule],
  exports: [FeedModule, PostModule, PostCommentModule, ClassInfoModule],
})
export class SocialFeedModule {}
