// users.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { SearchUserSysDto, CreateUserSysDto, UpdateUserSysDto } from './dto/users.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get user by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    const data = await this.usersService.findById(id);
    return { success: true, data };
  }

  /**
   * Search users with filters
   */
  @Get()
  @ApiOperation({ summary: 'Search users with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  async search(@Query() dto: SearchUserSysDto) {
    const data = await this.usersService.search(dto);
    return { success : true , data };
  }

  /**
   * Create a new user
   */
  @Post()
  @ApiOperation({ summary: 'Create a new user with auto-generated password' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async create(@Body() dto: CreateUserSysDto) {
    const user_sys_id = await this.usersService.create(dto);
    return { success: true, message: 'User created successfully', data: { user_sys_id } };
  }

  /**
   * Update an existing user
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update user by ID' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email or code already in use' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserSysDto) {
    const data = await this.usersService.update(id, dto);
    return { success: true, message: "User updated successfully", data };
  }

  /**
   * Delete a user
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete user by ID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    const data = await this.usersService.delete(id);
    return { success: true, message: "User deleted successfully", data };
  }
}
