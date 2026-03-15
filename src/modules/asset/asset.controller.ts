import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';
import type { Response } from 'express';
import { AssetService } from './asset.service';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { CreateAssetDto, SearchAssetDto, UpdateAssetDto } from './dto/asset.dto';

@ApiTags('Assets')
@Controller('assets')
export class AssetController {
    constructor(
        private readonly assetService: AssetService,
        private readonly logger: AppLogger,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Search assets with filters and pagination' })
    @ApiResponse({ status: 200, description: 'Returns filtered assets with total count' })
    @ApiResponse({ status: 400, description: 'No search parameters provided' })
    async search(@Query() dto: SearchAssetDto) {
        return this.assetService.search(dto);
    }

    @Patch('sync-status')
    @ApiOperation({ summary: 'Sync asset statuses based on current date' })
    @ApiResponse({ status: 200, description: 'Statuses updated successfully' })
    async syncStatuses() {
        await this.assetService.syncStatuses();
        return { success: true, message: 'Asset statuses synced successfully' };
    }

    @Get('active')
    @ApiOperation({ summary: 'Get active asset based on current date' })
    @ApiResponse({ status: 200, description: 'Returns active asset or default if no date match' })
    async getActiveAsset() {
        return this.assetService.getActiveAsset();
    }

    @Get('active/url')
    @ApiOperation({ summary: 'Get active theme image (redirect to image URL)' })
    @ApiResponse({ status: 302, description: 'Redirects to active theme image URL' })
    async getActiveThemeUrl(@Res() res: Response) {
        const imageUrl = await this.assetService.getActiveThemeUrl();
        return res.redirect(imageUrl);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Find asset by ID' })
    @ApiParam({ name: 'id', description: 'Asset ID (theme_id)', type: Number })
    @ApiResponse({ status: 200, description: 'Returns the asset' })
    @ApiResponse({ status: 404, description: 'Asset not found' })
    async findById(@Param('id', ParseIntPipe) id: number) {
        return this.assetService.findById(id);
    }

    @Post()
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'file', maxCount: 1 },
            { name: 'image', maxCount: 1 },
            { name: 'theme_image', maxCount: 1 },
        ]),
    )
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Create a new asset (upload file or provide URL)' })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['theme_name', 'is_default', 'flag_valid'],
            properties: {
                file: { type: 'string', format: 'binary', description: 'Image file (ถ้าไม่มีให้ส่ง theme_url แทน)' },
                theme_name: { type: 'string' },
                theme_url: { type: 'string', description: 'URL โดยตรง (ถ้าไม่ส่ง file)' },
                start_date: { type: 'string', example: '2024-05-01' },
                end_date: { type: 'string', example: '2024-09-30' },
                is_default: { type: 'boolean' },
                flag_valid: { type: 'boolean' },
                status: { type: 'string', enum: ['pending', 'active', 'completed', 'cancelled'] },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Asset created successfully' })
    @ApiResponse({ status: 400, description: 'Missing required fields or no theme_url/file' })
    async create(
        @Body() dto: CreateAssetDto,
        @UploadedFiles() files?: {
            file?: Express.Multer.File[];
            image?: Express.Multer.File[];
            theme_image?: Express.Multer.File[];
        },
    ) {
        const file = files?.file?.[0] || files?.image?.[0] || files?.theme_image?.[0];

        return this.assetService.create(dto, file);
    }

    @Put(':id')
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'file', maxCount: 1 },
            { name: 'image', maxCount: 1 },
            { name: 'theme_image', maxCount: 1 },
        ]),
    )
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Update asset by ID (upload new file or provide URL)' })
    @ApiParam({ name: 'id', description: 'Asset ID (theme_id)', type: Number })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: { type: 'string', format: 'binary', description: 'Image file ใหม่ (optional)' },
                theme_name: { type: 'string' },
                theme_url: { type: 'string', description: 'URL โดยตรง (ถ้าไม่ส่ง file)' },
                start_date: { type: 'string', example: '2024-05-01' },
                end_date: { type: 'string', example: '2024-09-30' },
                is_default: { type: 'boolean' },
                flag_valid: { type: 'boolean' },
                status: { type: 'string', enum: ['pending', 'active', 'completed', 'cancelled'] },
            },
        },
    })
    @ApiResponse({ status: 200, description: 'Asset updated successfully' })
    @ApiResponse({ status: 400, description: 'No fields to update' })
    @ApiResponse({ status: 404, description: 'Asset not found' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateAssetDto,
        @UploadedFiles() files?: {
            file?: Express.Multer.File[];
            image?: Express.Multer.File[];
            theme_image?: Express.Multer.File[];
        },
    ) {
        const file = files?.file?.[0] || files?.image?.[0] || files?.theme_image?.[0];

        return this.assetService.update(id, dto, file);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete asset by ID' })
    @ApiParam({ name: 'id', description: 'Asset ID (theme_id)', type: Number })
    @ApiResponse({ status: 200, description: 'Asset deleted successfully' })
    @ApiResponse({ status: 404, description: 'Asset not found' })
    async delete(@Param('id', ParseIntPipe) id: number) {
        return this.assetService.delete(id);
    }

}
