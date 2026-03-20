// admin.controller.ts
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
import { AdminService } from './admin.service';
import {
  CreateAdminDto,
  SearchAdminDto,
  UpdateAdminDto,
  LoginAdminDto,
} from './dto/admin.dto';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({
    summary: 'ค้นหา Admin',
    description: 'ค้นหา Admin ตามเงื่อนไขที่กำหนด',
  })
  @ApiResponse({ status: 200, description: 'สำเร็จ' })
  async getAdmin(@Query() dto: SearchAdminDto) {
    const result = await this.adminService.searchAdmin(dto);
    return result;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'สร้าง Admin ใหม่',
    description: 'สร้าง Admin ใหม่ในระบบ',
  })
  @ApiBody({ type: CreateAdminDto })
  @ApiResponse({ status: 201, description: 'สร้าง Admin สำเร็จ' })
  @ApiResponse({ status: 409, description: 'Username มีอยู่แล้ว' })
  async createAdmin(@Body() dto: CreateAdminDto) {
    const result = await this.adminService.createAdmin(dto);
    return result;
  }

  @Put(':username')
  @ApiOperation({
    summary: 'อัปเดตข้อมูล Admin',
    description: 'แก้ไขข้อมูล Admin ตาม username',
  })
  @ApiParam({ name: 'username', description: 'ชื่อผู้ใช้ Admin', type: String })
  @ApiBody({ type: UpdateAdminDto })
  @ApiResponse({ status: 200, description: 'อัปเดตสำเร็จ' })
  @ApiResponse({ status: 404, description: 'ไม่พบ Admin' })
  async updateAdmin(@Param('username') username: string, @Body() dto: UpdateAdminDto) {
    const result = await this.adminService.updateAdmin(username, dto);
    return result;
  }

  @Delete(':username')
  @ApiOperation({
    summary: 'ลบ Admin',
    description: 'ลบ Admin ออกจากระบบตาม username',
  })
  @ApiParam({ name: 'username', description: 'ชื่อผู้ใช้ Admin', type: String })
  @ApiResponse({ status: 200, description: 'ลบสำเร็จ' })
  @ApiResponse({ status: 404, description: 'ไม่พบ Admin' })
  async deleteAdmin(@Param('username') username: string) {
    const result = await this.adminService.deleteAdmin(username);
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'เข้าสู่ระบบ Admin',
    description: 'เข้าสู่ระบบด้วย username และ password เพื่อรับ JWT token',
  })
  @ApiBody({ type: LoginAdminDto })
  @ApiResponse({ status: 200, description: 'เข้าสู่ระบบสำเร็จ' })
  @ApiResponse({ status: 401, description: 'ข้อมูลไม่ถูกต้อง' })
  async loginAdmin(@Body() dto: LoginAdminDto) {
    const result = await this.adminService.loginAdmin(dto);
    return result;
  }
}
