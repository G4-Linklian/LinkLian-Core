import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CommunityService } from '../core/community.service';
import { FileStorageService } from '../../file-storage/file-storage.service';

function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  return matches ? matches : [];
}

function getDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return 'link';
  }
}

@Injectable()

export class CommunityPostService {

  constructor(
    private dataSource: DataSource,
    private communityService: CommunityService,
    private fileStorageService: FileStorageService,
  ) { }

//   async createPost(userId: number, dto: any, files?: Express.Multer.File[]) {

//     if (!dto || !dto.content?.trim()) {
//       throw new BadRequestException('Content required');
//     }

//     const community = await queryRunner.query(
//       `
//     SELECT status
//     FROM community
//     WHERE community_id=$1
//       AND flag_valid=true
//     `,
//       [dto.community_id],
//     );

//     if (!community.length) {
//       throw new BadRequestException('Community not found');
//     }

//     if (community[0].status !== 'active') {
//       throw new ForbiddenException('Community is inactive');
//     }
//     await this.communityService.checkReadPermission(
//       userId,
//       dto.community_id,
//     );

//     const queryRunner = this.dataSource.createQueryRunner();
//     await queryRunner.connect();
//     await queryRunner.startTransaction();

//     try {

//       const result = await queryRunner.manager.query(
//         `
//       INSERT INTO post_in_community
//       (community_id,user_sys_id,content,flag_valid)
//       VALUES ($1,$2,$3,true)
//       RETURNING post_commu_id
//       `,
//         [dto.community_id, userId, dto.content.trim()],
//       );

//       const postId = result[0].post_commu_id;

//     const detectedUrls = extractUrls(dto.content.trim());

// if (detectedUrls.length > 0) {
//   for (const url of detectedUrls) {

//     const domainName = getDomainFromUrl(url);

//     const linkResult = await queryRunner.query(
//       `
//       INSERT INTO community_attachment
//       (post_commu_id,file_url,file_type,original_name,flag_valid)
//       VALUES ($1,$2,'link',$3,true)
//       RETURNING attachment_id,file_url,file_type,original_name
//       `,
//       [
//         postId,
//         url,
//         domainName,
//       ],
//     );

//     console.log('Inserted link attachment:', linkResult[0]);
//   }
// }



//       if (files?.length) {

//         const uploadResult =
//           await this.fileStorageService.uploadFiles(
//             'community',
//             'post',
//             files,
//           );

//         for (const uploaded of uploadResult.files) {

//           let type = 'image';

//           if (uploaded.fileType.startsWith('video')) {
//             type = 'video';
//           }

//           if (uploaded.fileType.includes('pdf')) {
//             type = 'pdf';
//           }

//           await queryRunner.manager.query(
//             `
//             INSERT INTO community_attachment
//             (post_commu_id,file_url,file_type,original_name,flag_valid)
//             VALUES ($1,$2,$3,$4,true)
//             `,
//             [
//               postId,
//               uploaded.fileUrl,
//               type,
//               uploaded.originalName,
//             ],
//           );

//         }
//       }




//       await queryRunner.commitTransaction();

//       return {
//         success: true,
//         post_id: postId,
//       };

//     } catch (error) {

//       await queryRunner.rollbackTransaction();

//       throw error;

//     } finally {
//       await queryRunner.release();
//     }
//   }
async createPost(userId: number, dto: any, files?: Express.Multer.File[]) {

  if (!dto || !dto.content?.trim()) {
    throw new BadRequestException('Content required');
  }

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {

    const community = await queryRunner.query(
      `
      SELECT status
      FROM community
      WHERE community_id=$1
        AND flag_valid=true
      `,
      [dto.community_id],
    );

    if (!community.length) {
      throw new BadRequestException('Community not found');
    }

    if (community[0].status !== 'active') {
      throw new ForbiddenException('Community is inactive');
    }

    await this.communityService.checkReadPermission(
      userId,
      dto.community_id,
    );

    const result = await queryRunner.query(
      `
      INSERT INTO post_in_community
      (community_id,user_sys_id,content,flag_valid)
      VALUES ($1,$2,$3,true)
      RETURNING post_commu_id
      `,
      [dto.community_id, userId, dto.content.trim()],
    );

    const postId = result[0].post_commu_id;

    // ✅ Detect links
    const detectedUrls = extractUrls(dto.content.trim());

    for (const url of detectedUrls) {
      const domainName = getDomainFromUrl(url);

      await queryRunner.query(
        `
        INSERT INTO community_attachment
        (post_commu_id,file_url,file_type,original_name,flag_valid)
        VALUES ($1,$2,'link',$3,true)
        `,
        [postId, url, domainName],
      );
    }

    // ✅ Handle files
    if (files?.length) {
      const uploadResult =
        await this.fileStorageService.uploadFiles(
          'community',
          'post',
          files,
        );

      for (const uploaded of uploadResult.files) {

        let type = 'image';

        if (uploaded.fileType.startsWith('video')) {
          type = 'video';
        }

        if (uploaded.fileType.includes('pdf')) {
          type = 'pdf';
        }

        await queryRunner.query(
          `
          INSERT INTO community_attachment
          (post_commu_id,file_url,file_type,original_name,flag_valid)
          VALUES ($1,$2,$3,$4,true)
          `,
          [
            postId,
            uploaded.fileUrl,
            type,
            uploaded.originalName,
          ],
        );
      }
    }

    await queryRunner.commitTransaction();

    return {
      success: true,
      post_id: postId,
    };

  } catch (error) {

    await queryRunner.rollbackTransaction();
    throw error;

  } finally {

    await queryRunner.release();
  }
}


  async getPosts(
    userId: number,
    communityId: number,
    limit: number = 20,
    offset: number = 0,
    sort: string = 'newest',
  ) {

    await this.communityService.checkReadPermission(
      userId,
      communityId,
    );

    const order = sort === 'oldest' ? 'ASC' : 'DESC';

    return await this.dataSource.query(
      `
    SELECT
      cp.post_commu_id,
      cp.content,
      cp.created_at,
      u.first_name,
      u.last_name,
      u.profile_pic,

COALESCE(
  (
    SELECT json_agg(
      json_build_object(
        'url', ca.file_url,
        'type', ca.file_type,
        'original_name', ca.original_name
      )
    )
    FROM community_attachment ca
    WHERE ca.post_commu_id = cp.post_commu_id
      AND ca.flag_valid = true
  ),
  '[]'
) AS attachments

    FROM post_in_community cp
    JOIN user_sys u
      ON u.user_sys_id=cp.user_sys_id

    WHERE cp.community_id=$1
      AND cp.flag_valid=true

    ORDER BY cp.created_at ${order}
    LIMIT $2 OFFSET $3
    `,
      [communityId, limit, offset],
    );
  }

  async hardDeletePost(userId: number, postId: number) {

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {

      const post = await queryRunner.query(
        `
      SELECT user_sys_id
      FROM post_in_community
      WHERE post_commu_id=$1
      AND flag_valid=true
      `,
        [postId],
      );

      if (!post.length)
        throw new BadRequestException('Post not found');

      if (post[0].user_sys_id !== userId)
        throw new ForbiddenException('Not allowed');

      // 1. delete comment_path
      await queryRunner.query(`
      DELETE FROM community_comment_path
      WHERE descendant_id IN (
        SELECT commu_comment_id
        FROM community_comment
        WHERE post_commu_id=$1
      )
    `, [postId]);

      // 2. delete comments
      await queryRunner.query(`
      DELETE FROM community_comment
      WHERE post_commu_id=$1
    `, [postId]);

      // 3. delete bookmark
      await queryRunner.query(`
      DELETE FROM community_bookmark
      WHERE post_commu_id=$1
    `, [postId]);

      // 4. delete attachment
      await queryRunner.query(`
      DELETE FROM community_attachment
      WHERE post_commu_id=$1
    `, [postId]);

      // 5. delete post
      await queryRunner.query(`
      DELETE FROM post_in_community
      WHERE post_commu_id=$1
    `, [postId]);

      await queryRunner.commitTransaction();

      return { success: true };

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Compatibility wrapper used by controller/tests
  async deletePost(userId: number, postId: number) {
    return this.hardDeletePost(userId, postId);
  }
  async updatePost(
    userId: number,
    postId: number,
    dto: any,
    files?: Express.Multer.File[],
  ) {
    if (!dto?.content && !files?.length) {
      throw new BadRequestException('Nothing to update');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // check permission
      const post = await queryRunner.query(
        `
      SELECT user_sys_id, community_id
      FROM post_in_community
      WHERE post_commu_id=$1
        AND flag_valid=true
      `,
        [postId],
      );

      if (!post.length) {
        throw new BadRequestException('Post not found');
      }
      await this.communityService.checkReadPermission(
        userId,
        post[0].community_id,
      );

      if (Number(post[0].user_sys_id) !== userId) {
        throw new ForbiddenException('Not allowed');
      }

      // check community status
      const community = await queryRunner.query(
        `
      SELECT status
      FROM community
      WHERE community_id=$1
      `,
        [post[0].community_id],
      );

      if (!community.length) {
        throw new BadRequestException('Community not found');
      }

      if (community[0].status !== 'active') {
        throw new ForbiddenException('Community is inactive');
      }

      // update content if provided
      if (dto.content !== undefined) {
        await queryRunner.query(
          `
        UPDATE post_in_community
        SET content=$1,
            updated_at=now()
        WHERE post_commu_id=$2
        `,
          [dto.content.trim(), postId],
        );
      }
      if (dto.content !== undefined) {
  const detectedUrls = extractUrls(dto.content.trim());

  for (const url of detectedUrls) {
    const domainName = getDomainFromUrl(url);

    await queryRunner.query(
      `
      INSERT INTO community_attachment
      (post_commu_id,file_url,file_type,original_name,flag_valid)
      VALUES ($1,$2,'link',$3,true)
      `,
      [
        postId,
        url,
        domainName,
      ],
    );
  }
}


      // files update: delete old ones and add new ones
      if (files?.length) {
        await queryRunner.query(
          `
        DELETE FROM community_attachment
        WHERE post_commu_id=$1
        `,
          [postId],
        );

        const uploadResult =
          await this.fileStorageService.uploadFiles(
            'community',
            'post',
            files,
          );

        for (const uploaded of uploadResult.files) {
          let type = 'image';

          if (uploaded.fileType?.startsWith('video')) {
            type = 'video';
          }

          if (uploaded.fileType?.includes('pdf')) {
            type = 'pdf';
          }

          await queryRunner.query(
            `
          INSERT INTO community_attachment
          (post_commu_id,file_url,file_type,original_name,flag_valid)
          VALUES ($1,$2,$3,$4,true)
          `,
            [
              postId,
              uploaded.fileUrl,
              type,
              uploaded.originalName,
            ],
          );
        }
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Post updated successfully',
      };

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }



  async searchPosts(
    userId: number,
    communityId: number,
    keyword: string,
    limit: number = 50,
  ) {

    await this.communityService.checkReadPermission(
      userId,
      communityId,
    );

    return await this.dataSource.query(
      `
    SELECT
      cp.post_commu_id,
      cp.content,
      cp.created_at,
      u.first_name,
      u.last_name,
      u.profile_pic,

      COALESCE(
      (
        SELECT json_agg(
         json_build_object(
  'url', ca.file_url,
  'type', ca.file_type,
  'original_name', ca.original_name
)

          )
        )
        FROM community_attachment ca
        WHERE ca.post_commu_id = cp.post_commu_id
          AND ca.flag_valid = true
      ), '[]'
      ) AS attachments

    FROM post_in_community cp
    JOIN user_sys u
      ON u.user_sys_id = cp.user_sys_id

    WHERE cp.community_id = $1
      AND cp.flag_valid = true
      AND cp.content ILIKE '%' || $2 || '%'

    ORDER BY cp.created_at DESC
    LIMIT $3
    `,
      [communityId, keyword, limit],
    );
  }

}
