// role.controller.ts
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
import { RoleService } from './role.service';
import { CreateRoleDto, SearchRoleDto, UpdateRoleDto } from './dto/role.dto';

@ApiTags('Role')
@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @ApiOperation({
    summary: 'ค้นหา Role',
    description: 'ค้นหา Role ตามเงื่อนไขที่กำหนด',
  })
  @ApiResponse({ status: 200, description: 'สำเร็จ' })
  async getRole(@Query() dto: SearchRoleDto) {
    const data = await this.roleService.searchRole(dto);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'ดึงข้อมูล Role ตาม ID',
    description: 'ดึงข้อมูล Role จาก ID ที่ระบุ',
  })
  @ApiParam({ name: 'id', description: 'รหัส Role', type: Number })
  @ApiResponse({ status: 200, description: 'สำเร็จ' })
  @ApiResponse({ status: 404, description: 'ไม่พบ Role' })
  async getRoleById(@Param('id') id: number) {
    const data = await this.roleService.findById(id);
    return { success: true, data };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'อัปเดตข้อมูล Role',
    description: 'แก้ไขข้อมูล Role ตาม ID',
  })
  @ApiParam({ name: 'id', description: 'รหัส Role', type: Number })
  @ApiBody({ type: UpdateRoleDto })
  @ApiResponse({ status: 200, description: 'อัปเดตสำเร็จ' })
  @ApiResponse({ status: 404, description: 'ไม่พบ Role' })
  async updateRole(@Param('id') id: number, @Body() dto: UpdateRoleDto) {
    const result = await this.roleService.updateRole(id, dto);
    return { success: true, ...result };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'สร้าง Role ใหม่',
    description: 'สร้าง Role ใหม่ในระบบ',
  })
  @ApiBody({ type: CreateRoleDto })
  @ApiResponse({ status: 201, description: 'สร้าง Role สำเร็จ' })
  async createRole(@Body() dto: CreateRoleDto) {
    const result = await this.roleService.createRole(dto);
    return { success: true, ...result };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'ลบ Role', description: 'ลบ Role ออกจากระบบตาม ID' })
  @ApiParam({ name: 'id', description: 'รหัส Role', type: Number })
  @ApiResponse({ status: 200, description: 'ลบสำเร็จ' })
  @ApiResponse({ status: 404, description: 'ไม่พบ Role' })
  async deleteRole(@Param('id') id: number) {
    const result = await this.roleService.deleteRole(id);
    return { success: true, ...result };
  }
}
