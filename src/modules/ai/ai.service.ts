import { Injectable } from '@nestjs/common';
import { BullMQService } from 'src/common/bullmq/bullmq.service';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { PostSummaryDto, QuizGenerationDto } from './dto/post-summary.dto';
import { PostService } from '../social-feed/post/post.service';

const AI_QUEUE = 'ai-queue';

@Injectable()
export class AiService {
    constructor(
        private readonly bullmq: BullMQService,
        private readonly logger: AppLogger,
        private readonly postService: PostService,
    ) { }

    async postSummary(dto: PostSummaryDto) {
        this.logger.log(
            `Requesting post summary for post_id: ${dto.post_content_id}`,
            'AiPostSummary',
        );

        const post = await this.postService.searchPostMaster({ post_content_id: dto.post_content_id });

        const postJson = post.data.reduce((acc, item) => {
            if (!acc) {
                acc = {
                    post_content_id: item.post_content_id,
                    title: item.title,
                    content: item.content,
                    file: [],
                    file_count: 0,
                };
            }

            if (item.file_url) {
                acc.file.push({
                    attachment_id: item.attachment_id,
                    file_url: item.file_url,
                    file_type: item.file_type,
                    original_name: item.original_name,
                });
            }

            acc.file_count = acc.file.length;

            return acc;
        }, null);

        this.logger.debug('Post data for summary:', 'AiPostSummary', postJson);

        if (!postJson.file) {
            return {
                success: false,
                message: 'No files attached to the post, skipping summary generation.',
            }
        }

        const azure_path = `https://linklianstorage.blob.core.windows.net/ai-summary/summary-post-announcement/all-${dto.post_content_id}.json`;

        try {
            const response = await fetch(azure_path);
            if (response.ok) {
                const cached = await response.json();
                this.logger.debug('Returning cached summary from Azure', 'AiPostSummary');
                if (cached === null) {
                    return {
                        success: false,
                        message: 'Summary generation is in progress. Please check back later.',
                    }
                }
                return {
                    success: true,
                    data: cached,
                    message: 'Summary retrieved from cache.',
                };
            }
        } catch (error) {
            this.logger.error('Error fetching cached summary from Azure:', 'AiPostSummary', error);
        }

        this.logger.debug('Cache miss, sending to queue:', 'AiPostSummary', postJson);

        if (postJson.file_count > 1 && postJson.file.every((f) => f.file_type === 'pdf')) {
            return {
                success: false,
                message: 'Summary generation for posts with multiple PDF attachments is not supported at this time.',
            }
        }
        else if (postJson.file.length === 1 && postJson.file[0].file_type == 'pdf') {
            this.bullmq.addJob({
                queue: 'ai_summary_queue',
                job: 'post-summary',
                data: postJson,
            });

            return {
                success: true,
                is_sum: false,
                message: 'Summary generation in progress. Please check back later.',
            }
        } else {

            const data = this.bullmq.addJobAndWait({
                queue: 'ai_summary_queue',
                job: 'post-summary',
                data: postJson,
                timeout: 60_000,
            });

            return {
                success: true,
                data,
                message: 'Summary generated successfully.',
            }
        }
    }

    async quizGeneration(dto: QuizGenerationDto) {
        this.logger.log(
            `Requesting quiz generation`,
            'QuizGeneration',
            {
                post_content_id: dto.post_content_id,
                difficulty: dto.difficulty,
                num_questions: dto.num_questions,
            }
        );

        if (!dto.post_content_id) {
            return {
                success: false,
                message: 'post_content_id is required',
            }
        }

        if (!dto.difficulty) {
            return {
                success: false,
                message: 'difficulty is required',
            }
        }

        if (!dto.num_questions) {
            return {
                success: false,
                message: 'num_questions is required',
            }
        }

        // const url_text = `https://linklianstorage.blob.core.windows.net/ai-summary/summary-post-announcement/all-${dto.post_content_id}.txt`;

        // this.logger.debug(
        //     'Checking for cached quiz in Azure',
        //     'QuizGeneration',
        //     {
        //         url: url_text,
        //     }
        // )

        // try {
        //     const response = await fetch(url_text);
        //     this.logger.debug('Azure response for cached quiz', 'QuizGeneration', { status: response.status });
        //     if (response.ok) {
        //         const buffer = await response.arrayBuffer();
        //         const cached = new TextDecoder().decode(buffer);
        //         this.logger.debug('Cached quiz content from Azure', 'QuizGeneration', {
        //             cached,
        //             length: cached.length
        //         });

        //         if (!cached || cached.trim().length === 0 || cached === 'null') {
        //             return {
        //                 success: false,
        //                 message: 'Quiz generation is in progress. Please check back later.',
        //             }
        //         }
        //     }
        // } catch (error) {
        //     this.logger.error('Error fetching cached quiz from Azure:', 'QuizGeneration', error);
        // }

        this.logger.log(
            'Sending quiz generation job to queue',
            'QuizGeneration',
            {
                post_content_id: dto.post_content_id,
                difficulty: dto.difficulty,
                num_questions: dto.num_questions,
            }
        )

        return this.bullmq.addJobAndWait({
            queue: 'quiz_generation_queue',
            job: 'quiz-generation',
            data: {
                post_content_id: dto.post_content_id,
                difficulty: dto.difficulty || 'medium',
                num_questions: dto.num_questions || 5,
            },
            timeout: 60_000,
        });

    }
}
