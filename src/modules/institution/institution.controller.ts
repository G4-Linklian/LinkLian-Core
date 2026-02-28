// institution.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { InstitutionService } from './institution.service';
import {
  CreateInstitutionDto,
  SearchInstitutionDto,
  UpdateInstitutionDto,
  LoginInstitutionDto,
} from './dto/institution.dto';

@ApiTags('Institution')
@Controller('institution')
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}

  @Get()
  @ApiOperation({
    summary: 'ค้นหาสถาบัน',
    description: 'ค้นหาสถาบันตามเงื่อนไขที่กำหนด',
  })
  @ApiResponse({ status: 200, description: 'สำเร็จ' })
  async getInstitution(@Query() dto: SearchInstitutionDto) {
    const data = await this.institutionService.searchInstitution(dto);
    return data;
  }

  @Get('detail/:id')
  @ApiOperation({
    summary: 'ดึงข้อมูลสถาบันพร้อมรายละเอียดตาม ID',
    description: 'ดึงข้อมูลสถาบันจาก ID ที่ระบุ',
  })
  @ApiParam({ name: 'id', description: 'รหัสสถาบัน', type: Number })
  @ApiResponse({ status: 200, description: 'สำเร็จ' })
  @ApiResponse({ status: 404, description: 'ไม่พบสถาบัน' })
  async getInstitutionDetailById(@Param('id') id: number) {
    const data = await this.institutionService.findDetailById(id);
    return data;
  }

  @Get(':id')
  @ApiOperation({
    summary: 'ดึงข้อมูลสถาบันตาม ID',
    description: 'ดึงข้อมูลสถาบันจาก ID ที่ระบุ',
  })
  @ApiParam({ name: 'id', description: 'รหัสสถาบัน', type: Number })
  @ApiResponse({ status: 200, description: 'สำเร็จ' })
  @ApiResponse({ status: 404, description: 'ไม่พบสถาบัน' })
  async getInstitutionById(@Param('id') id: number) {
    const data = await this.institutionService.findById(id);
    return data;
  }

  @Put(':id')
  @ApiOperation({
    summary: 'อัปเดตข้อมูลสถาบัน',
    description: 'แก้ไขข้อมูลสถาบันตาม ID',
  })
  @ApiParam({ name: 'id', description: 'รหัสสถาบัน', type: Number })
  @ApiBody({ type: UpdateInstitutionDto })
  @ApiResponse({ status: 200, description: 'อัปเดตสำเร็จ' })
  @ApiResponse({ status: 404, description: 'ไม่พบสถาบัน' })
  async updateInstitution(
    @Param('id') id: number,
    @Body() dto: UpdateInstitutionDto,
  ) {
    const result = await this.institutionService.updateInstitution(id, dto);
    return result;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'สร้างสถาบันใหม่',
    description: 'ลงทะเบียนสถาบันใหม่ในระบบ',
  })
  @ApiBody({ type: CreateInstitutionDto })
  @ApiResponse({ status: 201, description: 'สร้างสถาบันสำเร็จ' })
  @ApiResponse({ status: 409, description: 'Email มีอยู่แล้ว' })
  async createInstitution(@Body() dto: CreateInstitutionDto) {
    const result = await this.institutionService.createInstitution(dto);
    return result;
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'ลบสถาบัน',
    description: 'ลบสถาบันออกจากระบบตาม ID',
  })
  @ApiParam({ name: 'id', description: 'รหัสสถาบัน', type: Number })
  @ApiResponse({ status: 200, description: 'ลบสำเร็จ' })
  @ApiResponse({ status: 404, description: 'ไม่พบสถาบัน' })
  async deleteInstitution(@Param('id') id: number) {
    const result = await this.institutionService.deleteInstitution(id);
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'เข้าสู่ระบบสถาบัน',
    description: 'เข้าสู่ระบบด้วย email และ password เพื่อรับ JWT token',
  })
  @ApiBody({ type: LoginInstitutionDto })
  @ApiResponse({ status: 200, description: 'เข้าสู่ระบบสำเร็จ' })
  @ApiResponse({ status: 401, description: 'ข้อมูลไม่ถูกต้อง' })
  async loginInstitution(@Body() dto: LoginInstitutionDto) {
    const result = await this.institutionService.loginInstitution(dto);
    return result;
  }
}
