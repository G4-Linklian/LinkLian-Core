import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, ILike } from 'typeorm';
import { CommunityEntity } from './entities/community.entity';
import { CommunityMemberEntity } from '../member/entities/community-member.entity';
import { CommunityTagNormalizeEntity } from './entities/community-tag-normalize.entity';
import { CommunityTagEntity } from './entities/community-tag.entity';

@Injectable()
export class CommunityService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CommunityEntity)
    private readonly repo: Repository<CommunityEntity>,
    @InjectRepository(CommunityMemberEntity)
    private readonly memberRepo: Repository<CommunityMemberEntity>,
    @InjectRepository(CommunityTagEntity)
    private readonly tagRepo: Repository<CommunityTagEntity>,
    @InjectRepository(CommunityTagNormalizeEntity)
    private readonly tagNormalizeRepo: Repository<CommunityTagNormalizeEntity>,

  ) { }

  async createCommunity(userId: number, dto: any) {


    const user = await this.dataSource.query(
      `
    SELECT role_id
    FROM user_sys
    WHERE user_sys_id=$1
    `,
      [userId],
    );

    if (!user.length) {
      throw new BadRequestException('User not found');
    }

    if (![2, 3].includes(Number(user[0].role_id))) {
      throw new ForbiddenException('Only students can create community');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {

      const isPrivate = dto.is_private;

      const community = this.repo.create({
        community_name: dto.name,
        description: dto.description || null,
        is_private: dto.is_private,
        image_banner: dto.image_banner,
        rule: dto.rules && dto.rules.length > 0 ? dto.rules : null,
        status: 'active',
        flag_valid: true,
      });

      const savedCommunity =
        await queryRunner.manager.save(community);

      const owner = this.memberRepo.create({
        community_id: savedCommunity.community_id,
        user_sys_id: userId,
        role: 'owner',
        status: 'active',
        request_at: new Date(),
        approve_at: new Date(),
        flag_valid: true,
      });

      await queryRunner.manager.save(owner);

      if (dto.tags && Array.isArray(dto.tags)) {

        for (let rawTag of dto.tags) {

          if (!rawTag) continue;

          const tagName = rawTag
            .toString()
            .trim()
            .toLowerCase()
            .replace('#', '');


          let tag = await queryRunner.manager.findOne(
            CommunityTagEntity,
            { where: { tag_name: tagName } },
          );

          if (!tag) {
            tag = queryRunner.manager.create(
              CommunityTagEntity,
              {
                tag_name: tagName,
                flag_valid: true,
              },
            );
            tag = await queryRunner.manager.save(tag);
          }

          const normalize = queryRunner.manager.create(
            CommunityTagNormalizeEntity,
            {
              community_id: savedCommunity.community_id,
              community_tag_id: tag.community_tag_id,
              flag_valid: true,
            },
          );

          await queryRunner.manager.save(normalize);
        }
      }

      await queryRunner.commitTransaction();

      return savedCommunity;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async listCommunity(userId: number, keyword?: string) {

    if (keyword && keyword.trim() !== '') {

      return await this.dataSource.query(
        `
      SELECT
        c.community_id,
        c.community_name,
        c.description,
        c.is_private,
        c.image_banner,
        c.status,

        (
          SELECT COUNT(*)::int
          FROM community_member cm
          WHERE cm.community_id = c.community_id
            AND cm.status = 'active'
            AND cm.flag_valid = true
        ) AS member_count,

        COALESCE(
          ARRAY(
            SELECT t.tag_name
            FROM community_tag_normalize tn
            JOIN community_tag t
              ON t.community_tag_id = tn.community_tag_id
            WHERE tn.community_id = c.community_id
                AND tn.flag_valid = true
          ),
          '{}'
        ) AS tags  ,

          COALESCE(
            (
              SELECT cm.status
              FROM community_member cm
              WHERE cm.community_id = c.community_id
                AND cm.user_sys_id = $1
                AND cm.flag_valid = true
              LIMIT 1
            ),
            'none'
          ) AS membership_status

      FROM community c
      WHERE c.flag_valid = true
        AND c.community_name ILIKE '%' || $2 || '%'
      ORDER BY c.created_at DESC
      `,
        [userId, keyword]
      );
    }

    return await this.dataSource.query(
      `
    SELECT
      c.community_id,
      c.community_name,
      c.description,
      c.is_private,
      c.image_banner,
      c.status,

      (
        SELECT COUNT(*)::int
        FROM community_member cm
        WHERE cm.community_id = c.community_id
          AND cm.status = 'active'
          AND cm.flag_valid = true
      ) AS member_count,

      COALESCE(
        ARRAY(
          SELECT t.tag_name
          FROM community_tag_normalize tn
          JOIN community_tag t
            ON t.community_tag_id = tn.community_tag_id
          WHERE tn.community_id = c.community_id
              AND tn.flag_valid = true
          ),
          '{}'
      ) AS tags,

        COALESCE(
          (
            SELECT cm.status
            FROM community_member cm
            WHERE cm.community_id = c.community_id
              AND cm.user_sys_id = $1
              AND cm.flag_valid = true
            LIMIT 1
          ),
          'none'
        ) AS membership_status

      FROM community c
      JOIN community_member m
        ON m.community_id = c.community_id
      AND m.user_sys_id = $1
       AND m.status = 'active' 
      AND m.flag_valid = true

      WHERE c.status = 'active'
        AND c.status = 'active'
      ORDER BY c.created_at DESC
    `,
      [userId],
    );
  }


  async getCommunity(id: number) {
    return await this.repo.findOne({
      where: { community_id: id, flag_valid: true },
    });
  }

  async checkReadPermission(userId: number, communityId: number) {

    const community = await this.dataSource.query(`
    SELECT status, is_private
    FROM community
    WHERE community_id=$1
      AND flag_valid=true
  `, [communityId]);

    if (!community.length) {
      throw new BadRequestException('Community not found');
    }

    const { status, is_private } = community[0];

    // 🔥 ถ้า inactive → อ่านได้
    if (status === 'inactive') {

      // public อ่านได้เสมอ
      if (!is_private) return true;

      // private อ่านได้เฉพาะ member เดิม หรือ owner เดิม
      const member = await this.dataSource.query(`
      SELECT 1 FROM community_member
  WHERE community_id=$1
    AND user_sys_id=$2
    AND status='active'
    AND flag_valid=true
    `, [communityId, userId]);

      if (!member.length) {
        throw new ForbiddenException('Private archive');
      }

      return true;
    }

    // ====== ACTIVE LOGIC เดิม ======

    if (!is_private) return true;

    const member = await this.dataSource.query(`
    SELECT 1 FROM community_member
    WHERE community_id=$1
      AND user_sys_id=$2
      AND status='active'
      AND flag_valid=true
  `, [communityId, userId]);

    if (!member.length) {
      throw new ForbiddenException('Private community access denied');
    }

    return true;
  }


  async getCommunityFeed(
    userId: number,
    communityId: number,
  ) {

    const community = await this.dataSource.query(
      `
    SELECT community_id, status, is_private
    FROM community
    WHERE community_id=$1
      AND flag_valid=true
    `,
      [communityId],
    );

    if (!community.length) {
      throw new BadRequestException('Community not found');
    }

    const { status, is_private } = community[0];

    if (status !== 'active') {
      throw new BadRequestException('Community inactive');
    }

    if (is_private) {
      const member = await this.dataSource.query(
        `
      SELECT 1 FROM community_member
      WHERE community_id=$1
        AND user_sys_id=$2
        AND status='active'
        AND flag_valid=true
      `,
        [communityId, userId],
      );

      if (!member.length) {
        throw new BadRequestException('Private community');
      }
    }

    return await this.dataSource.query(
      `
    SELECT
      p.post_commu_id,
      p.content,
      p.created_at,
      u.user_sys_id,
      u.first_name,
      u.last_name,
      u.profile_pic,

      -- count comments
      (
        SELECT COUNT(*)
        FROM community_comment cc
        WHERE cc.post_commu_id=p.post_commu_id
          AND cc.flag_valid=true
      ) AS comment_count,

      -- count bookmarks
      (
        SELECT COUNT(*)
        FROM community_bookmark cb
        WHERE cb.post_commu_id=p.post_commu_id
      ) AS bookmark_count,

      -- user bookmarked?
      EXISTS (
        SELECT 1
        FROM community_bookmark cb
        WHERE cb.post_commu_id=p.post_commu_id
          AND cb.user_sys_id=$2
      ) AS is_bookmarked

    FROM post_in_community p
    JOIN user_sys u
      ON u.user_sys_id=p.user_sys_id

    WHERE p.community_id=$1
      AND p.flag_valid=true

    ORDER BY p.created_at DESC
    `,
      [communityId, userId],
    );
  }
  

  async searchTag(keyword?: string) {

    const clean = keyword
      ?.replace('#', '')
      .trim() || '';

    if (clean === '') {
      return await this.tagRepo.find({
        where: { flag_valid: true },
        order: { tag_name: 'ASC' },
      });
    }

    return await this.tagRepo.find({
      where: {
        tag_name: ILike(`%${clean}%`),
        flag_valid: true,
      },
      order: { tag_name: 'ASC' },
    });
  }

  async getCommunityDetail(userId: number, communityId: number) {
    const result = await this.dataSource.query(
      `
    SELECT
      c.community_id,
      c.community_name,
      c.description,
      c.rule,
      c.is_private,
      c.image_banner,
      c.status,
      c.created_at,

      -- MEMBER COUNT
      (
        SELECT COUNT(*)::int
        FROM community_member cm
        WHERE cm.community_id = c.community_id
          AND cm.status = 'active'
          AND cm.flag_valid = true
      ) AS member_count,

      -- TAGS
      COALESCE(
        ARRAY(
          SELECT t.tag_name
          FROM community_tag_normalize tn
          JOIN community_tag t
            ON t.community_tag_id = tn.community_tag_id
          WHERE tn.community_id = c.community_id
            AND tn.flag_valid = true
        ),
        '{}'
      ) AS tags,

      -- CREATOR INFO (OWNER)
      u.user_sys_id AS creator_id,
      u.first_name,
      u.last_name,
      u.profile_pic,

      -- IS OWNER
      EXISTS (
        SELECT 1
        FROM community_member cm
        WHERE cm.community_id = c.community_id
          AND cm.user_sys_id = $2
          AND cm.role = 'owner'
          AND cm.flag_valid = true
      ) AS is_owner,

      -- MEMBERSHIP STATUS
      COALESCE(
        (
          SELECT cm.status
          FROM community_member cm
          WHERE cm.community_id = c.community_id
            AND cm.user_sys_id = $2
            AND cm.flag_valid = true
          LIMIT 1
        ),
        'none'
      ) AS membership_status

    FROM community c

    LEFT JOIN community_member cm_owner
      ON cm_owner.community_id = c.community_id
      AND cm_owner.role = 'owner'
      AND cm_owner.flag_valid = true

    LEFT JOIN user_sys u
      ON u.user_sys_id = cm_owner.user_sys_id

    WHERE c.community_id = $1
      AND c.flag_valid = true
    `,
      [communityId, userId],
    );

    if (!result.length) {
      throw new BadRequestException('Community not found');
    }

    return {
      ...result[0],
      current_user_id: userId,
    };
  }

  async updateCommunity(
    userId: number,
    communityId: number,
    dto: any,
  ) {

    if (!dto) {
      throw new BadRequestException('Body is required');
    }

    // check owner
    const owner = await this.dataSource.query(
      `
    SELECT 1
    FROM community_member
    WHERE community_id=$1
      AND user_sys_id=$2
      AND role='owner'
      AND status='active'
      AND flag_valid=true
    `,
      [communityId, userId],
    );

    if (!owner.length) {
      throw new ForbiddenException('Only owner can update community');
    }

    const old = await this.dataSource.query(
      `
    SELECT image_banner
    FROM community
    WHERE community_id=$1
    `,
      [communityId],
    );

    if (!old.length) {
      throw new BadRequestException('Community not found');
    }

    const fields: string[] = [];
    const values: any[] = [];
    let index = 1;

    if (dto.name !== undefined) {
      fields.push(`community_name=$${index++}`);
      values.push(dto.name);
    }

    if (dto.description !== undefined) {
      fields.push(`description=$${index++}`);
      values.push(dto.description);
    }

    const banner = dto.image_banner ?? old[0].image_banner;
    fields.push(`image_banner=$${index++}`);
    values.push(banner);

    if (fields.length === 0) {
      throw new BadRequestException('Nothing to update');
    }

    values.push(communityId);

    await this.dataSource.query(
      `
    UPDATE community
    SET ${fields.join(', ')},
        updated_at=now()
    WHERE community_id=$${index}
    `,
      values,
    );


    if (dto.tags && Array.isArray(dto.tags)) {

      await this.dataSource.query(`
    DELETE FROM community_tag_normalize
    WHERE community_id=$1
  `, [communityId]);

      for (let rawTag of dto.tags) {

        if (!rawTag) continue;

        const tagName = rawTag
          .toString()
          .trim()
          .toLowerCase()
          .replace('#', '');

        let tag = await this.dataSource.query(
          `SELECT community_tag_id FROM community_tag WHERE tag_name=$1`,
          [tagName],
        );

        let tagId;

        if (!tag.length) {
          const insertTag = await this.dataSource.query(
            `INSERT INTO community_tag (tag_name, flag_valid)
         VALUES ($1, true)
         RETURNING community_tag_id`,
            [tagName],
          );
          tagId = insertTag[0].community_tag_id;
        } else {
          tagId = tag[0].community_tag_id;
        }

        await this.dataSource.query(`
      INSERT INTO community_tag_normalize
      (community_id, community_tag_id, flag_valid)
      VALUES ($1,$2,true)
    `, [communityId, tagId]);
      }
    }


    return {
      success: true,
      message: 'Community updated successfully',
    };
  }


  async hardDeleteCommunity(userId: number, communityId: number) {

    const owner = await this.dataSource.query(
      `
    SELECT 1 FROM community_member
    WHERE community_id=$1
      AND user_sys_id=$2
      AND role='owner'
      AND status='active'
      AND flag_valid=true
    `,
      [communityId, userId],
    );

    if (!owner.length) {
      throw new ForbiddenException('Only owner can delete');
    }

    await this.dataSource.query(`
    DELETE FROM community_bookmark
    WHERE post_commu_id IN (
      SELECT post_commu_id
      FROM post_in_community
      WHERE community_id=$1
    )
  `, [communityId]);

    await this.dataSource.query(`
    DELETE FROM community_comment_path
    WHERE descendant_id IN (
      SELECT commu_comment_id
      FROM community_comment
      WHERE post_commu_id IN (
        SELECT post_commu_id
        FROM post_in_community
        WHERE community_id=$1
      )
    )
  `, [communityId]);


    await this.dataSource.query(`
    DELETE FROM community_comment
    WHERE post_commu_id IN (
      SELECT post_commu_id
      FROM post_in_community
      WHERE community_id=$1
    )
  `, [communityId]);

    await this.dataSource.query(`
    DELETE FROM community_attachment
    WHERE post_commu_id IN (
      SELECT post_commu_id
      FROM post_in_community
      WHERE community_id=$1
    )
  `, [communityId]);


    await this.dataSource.query(`
    DELETE FROM post_in_community
    WHERE community_id=$1
  `, [communityId]);


    await this.dataSource.query(`
    DELETE FROM community_member
    WHERE community_id=$1
  `, [communityId]);


    await this.dataSource.query(`
    DELETE FROM community_tag_normalize
    WHERE community_id=$1
  `, [communityId]);


    await this.dataSource.query(`
    DELETE FROM community
    WHERE community_id=$1
  `, [communityId]);

    return { success: true };
  }


}
