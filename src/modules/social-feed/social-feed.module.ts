// social-feed.module.ts
import { Module } from '@nestjs/common';
import { FeedModule } from './feed/feed.module';
import { PostModule } from './post/post.module';

@Module({
  imports: [FeedModule, PostModule],
  exports: [FeedModule, PostModule],
})
export class SocialFeedModule {}
