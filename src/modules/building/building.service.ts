// building.service.ts
import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Building } from './entities/building.entity';
import { SearchBuildingDto, CreateBuildingDto, UpdateBuildingDto } from './dto/building.dto';

@Injectable()
export class BuildingService {
  constructor(
    @InjectRepository(Building)
    private buildingRepo: Repository<Building>,
    private dataSource: DataSource,
  ) {}

  /**
   * Find building by ID
   */
  async findById(id: number) {
    const building = await this.buildingRepo.findOne({
      where: { building_id: id }
    });

    if (!building) {
      throw new NotFoundException('Building not found');
    }

    return building;
  }

  /**
   * Search buildings with filters and pagination
   */
  async search(dto: SearchBuildingDto) {
    // Validate that at least one search parameter is provided
    const hasInput = dto.building_id || dto.inst_id ||
                     dto.building_no || dto.building_name ||
                     dto.remark || typeof dto.flag_valid === 'boolean';

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    // Build raw query for flexible filtering
    let query = `SELECT * FROM building b WHERE 1=1`;
    const values: any[] = [];
    let index = 1;

    if (dto.building_id) {
      query += ` AND b.building_id = $${index++}`;
      values.push(dto.building_id);
    }

    if (dto.inst_id) {
      query += ` AND b.inst_id = $${index++}`;
      values.push(dto.inst_id);
    }

    if (dto.building_no) {
      query += ` AND b.building_no = $${index++}`;
      values.push(dto.building_no);
    }

    if (dto.building_name) {
      query += ` AND b.building_name = $${index++}`;
      values.push(dto.building_name);
    }

    if (dto.remark) {
      query += ` AND b.remark = $${index++}`;
      values.push(dto.remark);
    }

    if (typeof dto.flag_valid === 'boolean') {
      query += ` AND b.flag_valid = $${index++}`;
      values.push(dto.flag_valid);
    }

    // Sort
    if (dto.sort_by) {
      const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY b.${dto.sort_by} ${order}`;
    }

    // Pagination
    if (dto.limit) {
      query += ` LIMIT $${index++}`;
      values.push(dto.limit);
    }

    if (dto.offset) {
      query += ` OFFSET $${index++}`;
      values.push(dto.offset);
    }

    try {
      const result = await this.dataSource.query(query, values);
      return { data: result };
    } catch (err) {
      console.error('Error executing search building query:', err);
      throw new InternalServerErrorException('Error fetching buildings');
    }
  }

  /**
   * Create a new building
   */
  async create(dto: CreateBuildingDto) {
    if (!dto.inst_id || !dto.building_no || !dto.building_name) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const newBuilding = this.buildingRepo.create({
        inst_id: dto.inst_id,
        building_no: dto.building_no,
        building_name: dto.building_name,
        remark: dto.remark || null,
        flag_valid: true,
      });

      const savedBuilding = await this.buildingRepo.save(newBuilding);
      return { message: 'Building created successfully!', data: savedBuilding };

    } catch (error) {
      console.error('Error creating building:', error);
      throw new InternalServerErrorException('Error creating building');
    }
  }

  /**
   * Update an existing building
   */
  async update(id: number, dto: UpdateBuildingDto) {
    // Check if building exists
    const existingBuilding = await this.buildingRepo.findOne({
      where: { building_id: id }
    });

    if (!existingBuilding) {
      throw new NotFoundException('Building not found');
    }

    // Build update object dynamically
    const updates: Partial<Building> = {};

    if (dto.inst_id !== undefined) updates.inst_id = dto.inst_id;
    if (dto.building_no !== undefined) updates.building_no = dto.building_no;
    if (dto.building_name !== undefined) updates.building_name = dto.building_name;
    if (dto.remark !== undefined) updates.remark = dto.remark;
    if (dto.room_format !== undefined) updates.room_format = dto.room_format;
    if (typeof dto.flag_valid === 'boolean') updates.flag_valid = dto.flag_valid;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No fields to update!');
    }

    try {
      await this.buildingRepo.update({ building_id: id }, updates);
      
      const updatedBuilding = await this.buildingRepo.findOne({
        where: { building_id: id }
      });

      return { message: 'Building updated successfully!', data: updatedBuilding };

    } catch (error) {
      console.error('Error updating building:', error);
      throw new InternalServerErrorException('Error updating building');
    }
  }

  /**
   * Delete a building by ID
   */
  async delete(id: number) {
    // Check if building exists
    const existingBuilding = await this.buildingRepo.findOne({
      where: { building_id: id }
    });

    if (!existingBuilding) {
      throw new NotFoundException('Building not found');
    }

    try {
      await this.buildingRepo.delete({ building_id: id });
      return { message: 'Building deleted successfully!', data: existingBuilding };

    } catch (error) {
      console.error('Error deleting building:', error);
      throw new InternalServerErrorException('Error deleting building');
    }
  }
}
