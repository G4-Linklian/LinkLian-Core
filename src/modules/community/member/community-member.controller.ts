import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Headers,
} from '@nestjs/common';

import { CommunityMemberService } from './community-member.service';

@Controller('community/member')
export class CommunityMemberController {
  constructor(
    private readonly service: CommunityMemberService,
  ) { }

  @Post(':communityId')
  join(
    @Headers('x-user-id') userId: string,
    @Param('communityId') communityId: string,
  ) {
    return this.service.joinCommunity(
      Number(userId),
      Number(communityId),
    );
  }

  @Post(':communityId/approve/:targetUserId')
  approve(
    @Headers('x-user-id') ownerId: string,
    @Param('communityId') communityId: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.service.approveMember(
      Number(ownerId),
      Number(communityId),
      Number(targetUserId),
    );
  }

  @Delete(':communityId/reject/:targetUserId')
  reject(
    @Headers('x-user-id') ownerId: string,
    @Param('communityId') communityId: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.service.rejectMember(
      Number(ownerId),
      Number(communityId),
      Number(targetUserId),
    );
  }

  @Delete(':communityId')
  leave(
    @Headers('x-user-id') userId: string,
    @Param('communityId') communityId: string,
  ) {
    return this.service.leaveCommunity(
      Number(userId),
      Number(communityId),
    );
  }

  @Get(':communityId/pending')
  pendingMembers(
    @Headers('x-user-id') ownerId: string,
    @Param('communityId') communityId: string,
  ) {
    return this.service.getPendingMembers(
      Number(ownerId),
      Number(communityId),
    );
  }

  @Get(':communityId')
  members(
    @Param('communityId') communityId: string,
  ) {
    return this.service.getMembers(
      Number(communityId),
    );
  }
}
