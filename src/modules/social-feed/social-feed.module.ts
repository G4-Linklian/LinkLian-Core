// social-feed.module.ts
import { Module } from '@nestjs/common';
import { FeedModule } from './feed/feed.module';
import { PostModule } from './post/post.module';
import { PostCommentModule } from './post-comment';

@Module({
  imports: [FeedModule, PostModule, PostCommentModule],
  exports: [FeedModule, PostModule, PostCommentModule],
})
export class SocialFeedModule {}
