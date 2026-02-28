import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class CommunityMemberService {
  constructor(private dataSource: DataSource) {}

  async joinCommunity(userId: number, communityId: number) {
    try {
      const community = await this.dataSource.query(
        `
    SELECT status, is_private
    FROM community
    WHERE community_id=$1
    AND flag_valid=true
    `,
        [communityId],
      );

      if (!community.length) {
        throw new BadRequestException('Community not found');
      }

      if (community[0].status !== 'active') {
        throw new ForbiddenException('Community is inactive');
      }

      const isPrivate = community[0].is_private;
      const newStatus = isPrivate ? 'pending' : 'active';

      const existing = await this.dataSource.query(
        `
    SELECT *
    FROM community_member
    WHERE community_id=$1
      AND user_sys_id=$2
    `,
        [communityId, userId],
      );

      let result;
      if (existing.length > 0) {
        if (
          existing[0].flag_valid === true &&
          existing[0].status === 'active'
        ) {
          throw new BadRequestException('Already joined');
        }

        result = await this.dataSource.query(
          `
      UPDATE community_member
      SET flag_valid=true,
          status=$3,
          request_at=now()
      WHERE community_id=$1
        AND user_sys_id=$2
      RETURNING *
      `,
          [communityId, userId, newStatus],
        );
      } else {
        result = await this.dataSource.query(
          `
    INSERT INTO community_member
    (community_id,user_sys_id,role,status,request_at,flag_valid)
    VALUES ($1,$2,'member',$3,now(),true)
    RETURNING *
    `,
          [communityId, userId, newStatus],
        );
      }
      return {
        success: true,
        data: result[0],
        message:
          newStatus === 'active'
            ? 'Joined community successfully!'
            : 'Join request sent successfully!',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Error joining community');
    }
  }

  async approveMember(
    ownerId: number,
    communityId: number,
    targetUserId: number,
  ) {
    const community = await this.dataSource.query(
      `
      SELECT status FROM community
      WHERE community_id=$1
      `,
      [communityId],
    );

    if (community.length === 0) {
      throw new BadRequestException('Community not found');
    }

    if (community[0].status !== 'active') {
      throw new ForbiddenException('Community is inactive');
    }
    try {
      const owner = await this.dataSource.query(
        `
      SELECT 1 FROM community_member
      WHERE community_id=$1
        AND user_sys_id=$2
        AND role='owner'
        AND status='active'
        AND flag_valid=true
      `,
        [communityId, ownerId],
      );

      if (owner.length === 0) {
        throw new ForbiddenException('Only owner can approve');
      }

      const target = await this.dataSource.query(
        `
      SELECT status FROM community_member
      WHERE community_id=$1
        AND user_sys_id=$2
        AND flag_valid=true
      `,
        [communityId, targetUserId],
      );

      if (target.length === 0) {
        throw new BadRequestException('User not found in community');
      }

      if (target[0].status === 'active') {
        throw new BadRequestException('User already approved');
      }

      if (target[0].status !== 'pending') {
        throw new BadRequestException('Invalid member status');
      }

      const result = await this.dataSource.query(
        `
      UPDATE community_member
      SET status='active',
          approve_at=now()
      WHERE community_id=$1
        AND user_sys_id=$2
        AND status='pending'
      RETURNING *
      `,
        [communityId, targetUserId],
      );
      console.log('APPROVE RESULT:', result);
      if (!result.length) {
        throw new BadRequestException('Invalid member status');
      }

      return {
        success: true,
        data: result[0][0],
        message: 'Member approved successfully!',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Error approving member');
    }
  }

  async leaveCommunity(userId: number, communityId: number) {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const member = await queryRunner.query(
        `
        SELECT role, flag_valid, status
        FROM community_member
        WHERE community_id=$1 AND user_sys_id=$2
        `,
        [communityId, userId],
      );

      if (member.length === 0) {
        throw new BadRequestException('Not a member');
      }

      if (member[0].flag_valid === false) {
        throw new BadRequestException('Already left community');
      }

      if (member[0].role === 'owner' && member[0].status === 'active') {
        await queryRunner.query(
          `
          UPDATE community
          SET status='inactive'
          WHERE community_id=$1
          `,
          [communityId],
        );
      }

      await queryRunner.query(
        `
        UPDATE community_member
        SET flag_valid=false,
            status='inactive'
        WHERE community_id=$1
          AND user_sys_id=$2
        `,
        [communityId, userId],
      );

      await queryRunner.commitTransaction();
      return {
        success: true,
        data: { community_id: communityId },
        message: 'Left community successfully!',
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getMembers(communityId: number) {
    try {
      const result = await this.dataSource.query(
        `
      SELECT u.user_sys_id,
             u.first_name,
             u.last_name,
             u.profile_pic
      FROM community_member cm
      JOIN user_sys u
        ON u.user_sys_id=cm.user_sys_id
      WHERE cm.community_id=$1
        AND cm.status='active'
        AND cm.flag_valid=true
      `,
        [communityId],
      );
      return {
        success: true,
        data: { members: result },
        message: 'Members fetched successfully!',
      };
    } catch {
      throw new InternalServerErrorException('Error fetching members');
    }
  }
  async getPendingMembers(ownerId: number, communityId: number) {
    const owner = await this.dataSource.query(
      `
    SELECT 1 FROM community_member
    WHERE community_id=$1
      AND user_sys_id=$2
      AND role='owner'
      AND status='active'
      AND flag_valid=true
    `,
      [communityId, ownerId],
    );

    if (owner.length === 0) {
      throw new ForbiddenException('Only owner can view pending members');
    }

    const result = await this.dataSource.query(
      `
    SELECT u.user_sys_id,
         u.first_name,
         u.last_name,
         u.profile_pic,
         cm.status
  FROM community_member cm
  JOIN user_sys u
    ON u.user_sys_id = cm.user_sys_id
  WHERE cm.community_id = $1
    AND cm.flag_valid = true
    AND cm.role = 'member'
    AND cm.status = 'pending'
  ORDER BY 
    CASE 
      WHEN cm.status = 'pending' THEN 1
      WHEN cm.status = 'active' THEN 2
    END
    `,
      [communityId],
    );
    return {
      success: true,
      data: { members: result },
      message: 'Pending members fetched successfully!',
    };
  }
  catch(error) {
    if (error instanceof ForbiddenException) throw error;
    throw new InternalServerErrorException('Error fetching pending members');
  }

  async rejectMember(
    ownerId: number,
    communityId: number,
    targetUserId: number,
  ) {
    const community = await this.dataSource.query(
      `
  SELECT status FROM community
  WHERE community_id=$1
  `,
      [communityId],
    );

    if (!community.length) {
      throw new BadRequestException('Community not found');
    }

    if (community[0].status !== 'active') {
      throw new ForbiddenException('Community is inactive');
    }

    try {
      const owner = await this.dataSource.query(
        `
    SELECT 1 FROM community_member
    WHERE community_id=$1
      AND user_sys_id=$2
      AND role='owner'
      AND status='active'
      AND flag_valid=true
    `,
        [communityId, ownerId],
      );

      if (owner.length === 0) {
        throw new ForbiddenException('Only owner can reject');
      }

      const target = await this.dataSource.query(
        `
    SELECT status FROM community_member
    WHERE community_id=$1
      AND user_sys_id=$2
      AND flag_valid=true
    `,
        [communityId, targetUserId],
      );

      if (target.length === 0) {
        throw new BadRequestException('User not found');
      }

      if (!['pending', 'active'].includes(target[0].status)) {
        throw new BadRequestException('Invalid member status');
      }

      await this.dataSource.query(
        `
    UPDATE community_member
    SET flag_valid=false,
        status='inactive'
    WHERE community_id=$1
      AND user_sys_id=$2
    `,
        [communityId, targetUserId],
      );

      return {
        success: true,
        data: { user_sys_id: targetUserId },
        message: 'Member rejected successfully!',
      };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Error rejecting member');
    }
  }
}
