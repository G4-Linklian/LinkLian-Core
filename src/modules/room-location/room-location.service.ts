// room-location.service.ts
import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RoomLocation } from './entities/room-location.entity';
import { SearchRoomLocationDto, CreateRoomLocationDto, CreateRoomLocationBatchDto, UpdateRoomLocationDto } from './dto/room-location.dto';

@Injectable()
export class RoomLocationService {
  constructor(
    @InjectRepository(RoomLocation)
    private roomLocationRepo: Repository<RoomLocation>,
    private dataSource: DataSource,
  ) {}

  /**
   * Find room location by ID
   */
  async findById(id: number) {
    const roomLocation = await this.roomLocationRepo.findOne({
      where: { room_location_id: id }
    });

    if (!roomLocation) {
      throw new NotFoundException('Room location not found');
    }

    return roomLocation;
  }

  /**
   * Search room locations with filters, joins to building table, and pagination
   * Includes total_count for pagination info
   */
  async search(dto: SearchRoomLocationDto) {
    // Validate that at least one search parameter is provided
    const hasInput = dto.room_location_id || dto.building_id ||
                     dto.room_number || dto.room_remark ||
                     dto.floor || typeof dto.flag_valid === 'boolean';

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    // Build raw query with JOIN to building table and total count
    let query = `
      SELECT rl.*, b.building_no, b.building_name, COUNT(*) OVER() as total_count 
      FROM room_location rl
      LEFT JOIN building b ON rl.building_id = b.building_id
      WHERE 1=1
    `;
    const values: any[] = [];
    let index = 1;

    if (dto.room_location_id) {
      query += ` AND rl.room_location_id = $${index++}`;
      values.push(dto.room_location_id);
    }

    if (dto.building_id) {
      query += ` AND rl.building_id = $${index++}`;
      values.push(dto.building_id);
    }

    if (dto.room_number) {
      query += ` AND rl.room_number = $${index++}`;
      values.push(dto.room_number);
    }

    if (dto.floor) {
      query += ` AND rl.floor = $${index++}`;
      values.push(dto.floor);
    }

    if (dto.room_remark) {
      query += ` AND rl.room_remark = $${index++}`;
      values.push(dto.room_remark);
    }

    if (typeof dto.flag_valid === 'boolean') {
      query += ` AND rl.flag_valid = $${index++}`;
      values.push(dto.flag_valid);
    }

    // Sort - by floor (as integer) first, then by specified field
    if (dto.sort_by) {
      const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY rl.floor::integer, rl.${dto.sort_by} ${order}`;
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
      console.error('Error executing search room location query:', err);
      throw new InternalServerErrorException('Error fetching room locations');
    }
  }

  /**
   * Create a new room location
   */
  async create(dto: CreateRoomLocationDto) {
    if (!dto.building_id || !dto.room_number || !dto.floor) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const newRoomLocation = this.roomLocationRepo.create({
        building_id: dto.building_id,
        room_number: dto.room_number,
        room_remark: dto.room_remark || null,
        floor: dto.floor,
        flag_valid: true,
      });

      const savedRoomLocation = await this.roomLocationRepo.save(newRoomLocation);
      return { message: 'Room location created successfully!', data: savedRoomLocation };

    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new ConflictException('Duplicate room number in the same building');
      }
      console.error('Error creating room location:', error);
      throw new InternalServerErrorException('Error creating room location');
    }
  }

  /**
   * Create multiple room locations in batch with transaction
   * Validates for duplicates within the payload and against existing records
   */
  async createBatch(dto: CreateRoomLocationBatchDto) {
    const rooms = dto.rooms;

    // Validate array is not empty
    if (!rooms || rooms.length === 0) {
      throw new BadRequestException('Input data must be a non-empty array!');
    }

    // Validate required fields for each room
    const isValid = rooms.every(room =>
      room.building_id &&
      room.room_number &&
      room.floor !== undefined
    );

    if (!isValid) {
      throw new BadRequestException('Missing required fields in some items!');
    }

    // Check for duplicates within the payload
    const seen = new Set<string>();
    for (const room of rooms) {
      const key = `${room.building_id}-${room.floor}-${room.room_number}`;
      if (seen.has(key)) {
        throw new ConflictException(
          `Duplicate room found in payload: Building ${room.building_id}, Floor ${room.floor}, Room ${room.room_number}`
        );
      }
      seen.add(key);
    }

    // Use transaction for batch insert
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Build batch insert query
      const valueList: any[] = [];
      const placeholders: string[] = [];
      let paramIndex = 1;

      rooms.forEach((room) => {
        valueList.push(
          room.building_id,
          room.room_number,
          room.room_remark || '',
          room.floor,
          true
        );

        placeholders.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`
        );

        paramIndex += 5;
      });

      const query = `
        INSERT INTO room_location 
        (building_id, room_number, room_remark, floor, flag_valid)
        VALUES ${placeholders.join(', ')}
        RETURNING *;
      `;

      const result = await queryRunner.query(query, valueList);

      // Commit transaction
      await queryRunner.commitTransaction();

      return { 
        message: `Created ${result.length} rooms successfully!`, 
        data: result 
      };

    } catch (error: any) {
      // Rollback on error
      await queryRunner.rollbackTransaction();
      console.error('Batch insert error:', error);

      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new ConflictException('Duplicate room number in the same building');
      }

      throw new InternalServerErrorException('Error creating room locations');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update an existing room location
   */
  async update(id: number, dto: UpdateRoomLocationDto) {
    // Check if room location exists
    const existingRoom = await this.roomLocationRepo.findOne({
      where: { room_location_id: id }
    });

    if (!existingRoom) {
      throw new NotFoundException('Room location not found');
    }

    // Build update object dynamically
    const updates: Partial<RoomLocation> = {};

    if (dto.building_id !== undefined) updates.building_id = dto.building_id;
    if (dto.room_number !== undefined) updates.room_number = dto.room_number;
    if (dto.floor !== undefined) updates.floor = dto.floor;
    if (dto.room_remark !== undefined) updates.room_remark = dto.room_remark;
    if (typeof dto.flag_valid === 'boolean') updates.flag_valid = dto.flag_valid;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No fields to update!');
    }

    try {
      await this.roomLocationRepo.update({ room_location_id: id }, updates);
      
      const updatedRoom = await this.roomLocationRepo.findOne({
        where: { room_location_id: id }
      });

      return { message: 'Room location updated successfully!', data: updatedRoom };

    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new ConflictException('Duplicate room number in the same building');
      }
      console.error('Error updating room location:', error);
      throw new InternalServerErrorException('Error updating room location');
    }
  }

  /**
   * Delete a room location by ID
   */
  async delete(id: number) {
    // Check if room location exists
    const existingRoom = await this.roomLocationRepo.findOne({
      where: { room_location_id: id }
    });

    if (!existingRoom) {
      throw new NotFoundException('Room location not found');
    }

    try {
      await this.roomLocationRepo.delete({ room_location_id: id });
      return { message: 'Room location deleted successfully!', data: existingRoom };

    } catch (error) {
      console.error('Error deleting room location:', error);
      throw new InternalServerErrorException('Error deleting room location');
    }
  }
}
