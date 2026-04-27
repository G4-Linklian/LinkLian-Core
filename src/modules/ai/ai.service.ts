import { Injectable } from '@nestjs/common';
import { BullMQService } from 'src/common/bullmq/bullmq.service';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { PostSummaryDto, QuizGenerationDto } from './dto/post-summary.dto';
import { QaChatDto } from './dto/qa-chat.dto';
import { ClearChatSessionDto } from './dto/clear-chat-session.dto';
import { PostService } from '../social-feed/post/post.service';
import { AiRedisService } from './redis/ai-redis.service';
import { AiChatService } from '../ai-chat/ai-chat.service';

@Injectable()
export class AiService {
    constructor(
        private readonly bullmq: BullMQService,
        private readonly logger: AppLogger,
        private readonly postService: PostService,
        private readonly aiRedisService: AiRedisService,
        private readonly aiChatService: AiChatService,
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

        const url_text = `https://linklianstorage.blob.core.windows.net/ai-summary/summary-post-announcement/all-${dto.post_content_id}.txt`;

        this.logger.debug(
            'Checking for cached quiz in Azure',
            'QuizGeneration',
            {
                url: url_text,
            }
        )

        try {
            const response = await fetch(url_text);
            this.logger.debug('Azure response for cached quiz', 'QuizGeneration', { status: response.status });
            if (response.ok) {
                const buffer = await response.arrayBuffer();
                const cached = new TextDecoder().decode(buffer);
                this.logger.debug('Cached quiz content from Azure', 'QuizGeneration', {
                    cached,
                    length: cached.length
                });

                if (!cached || cached.trim().length === 0 || cached === 'null') {
                    return {
                        success: false,
                        message: 'Quiz generation is in progress. Please check back later.',
                    }
                }
            }
        } catch (error) {
            this.logger.error('Error fetching cached quiz from Azure:', 'QuizGeneration', error);
        }

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

    async qaChat(dto: QaChatDto) {
        this.logger.log('Requesting QA chat response', 'QaChat', {
            ai_chat_id: dto.ai_chat_id,
        });

        let assistantContent: any;

        try {

            let minutesSinceLastActivity: number | null = null;
            const lastActivity = await this.aiRedisService.getLastActivity(dto.ai_chat_id);

            if (lastActivity) {
                const now = Date.now();
                const diffMs = now - lastActivity;
                minutesSinceLastActivity = Math.floor(diffMs / (1000 * 60));
            }

            this.logger.debug('Last activity for chat', 'QaChat', {
                ai_chat_id: dto.ai_chat_id,
                last_activity: lastActivity,
                minutes_since_last_activity: minutesSinceLastActivity,
            });

            if (minutesSinceLastActivity === null) {

                this.logger.log('No existing chat session found, starting new session', 'QaChat', {
                    ai_chat_id: dto.ai_chat_id,
                });

                // Call chat history from database to warm up cache for new session
                const chatHistory = await this.aiChatService.searchAiMessages({ ai_chat_id: dto.ai_chat_id });

                if (Array.isArray(chatHistory.data)) {
                    for (const message of chatHistory.data) {
                        if (!message?.role || !message?.content) {
                            continue;
                        }

                        await this.aiRedisService.addMessage(
                            message.ai_chat_id ?? dto.ai_chat_id,
                            String(message.role),
                            String(message.content),
                        );
                    }
                }

                this.logger.debug('Chat history loaded from database', 'QaChat', {
                    ai_chat_id: dto.ai_chat_id,
                    history: chatHistory.data,
                });


                // Call Docs overview from blob storage to warm up cache for new session
                const azure_path = `https://linklianstorage.blob.core.windows.net/ai-summary/summary-post-announcement/all-${dto.post_content_id}.json`;

                try {
                    const response = await fetch(azure_path);
                    if (response.ok) {
                        const cached = await response.json();
                        const docsOverview =
                            typeof cached?.document_overview === 'string'
                                ? cached.document_overview
                                : '';

                        if (docsOverview) {
                            await this.aiRedisService.setDocsOverview(
                                dto.ai_chat_id,
                                docsOverview,
                            );
                        }

                        this.logger.debug('Docs overview loaded from Azure', 'QaChat', {
                            ai_chat_id: dto.ai_chat_id,
                            post_content_id: dto.post_content_id,
                            docs_overview: docsOverview,
                        });
                    }
                } catch (error) {
                    this.logger.error('Error fetching cached summary from Azure:', 'AiPostSummary', error);
                }


            }

            const data = await this.bullmq.addJobAndWait({
                queue: 'qa_chat_queue',
                job: 'qa-chat',
                data: {
                    ai_chat_id: dto.ai_chat_id,
                    question: dto.question,
                    post_id: dto.post_content_id,
                },
                timeout: 60_000,
            });

            this.logger.debug('QA chat response from worker', 'QaChat', {
                ai_chat_id: dto.ai_chat_id,
                response: data,
            });

            assistantContent =
                typeof data === 'string'
                    ? data
                    : typeof data === 'object' && data !== null && 'result' in data
                        ? String((data as { result?: unknown }).result ?? '')
                        : '';

            if (assistantContent) {
                await this.aiRedisService.addMessage(
                    dto.ai_chat_id,
                    'user',
                    dto.question,
                );

                await this.aiRedisService.addMessage(
                    dto.ai_chat_id,
                    'system',
                    assistantContent,
                );

                this.logger.log(
                    'QA chat response cached and saved to database',
                    'QaChat',
                    {
                        ai_chat_id: dto.ai_chat_id,
                        question: dto.question,
                        assistant_content_length: assistantContent.length,
                    }
                )


                return assistantContent;
            }

        } catch (error) {
            this.logger.error('Failed to update chat history cache', 'QaChat', error);
        }
    }

    async clearQaChatSession(dto: ClearChatSessionDto) {
        const deletedKeys = await this.aiRedisService.clearChatSession(dto.ai_chat_id);

        this.logger.log('Cleared QA chat Redis session keys', 'QaChat', {
            ai_chat_id: dto.ai_chat_id,
            deleted_keys: deletedKeys,
        });

        return {
            success: true,
            data: {
                ai_chat_id: dto.ai_chat_id,
                deleted_keys: deletedKeys,
            },
            message: 'QA chat Redis session cleared successfully.',
        };
    }
}
