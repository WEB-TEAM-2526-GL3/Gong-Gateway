import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Repository,
  UpdateResult,
  FindOptionsWhere,
  FindManyOptions,
  DeepPartial,
} from 'typeorm';

@Injectable()
export class GenericService<
  T extends { id: ID },
  ID extends number | string = number,
> {
  constructor(protected genericRepository: Repository<T>) {}

  findAll(): Promise<T[]> {
    return this.genericRepository.find({
      withDeleted: true,
    });
  }

  create(addDto: T): Promise<T> {
    return this.genericRepository.save(addDto);
  }

  createMany(addDtos: T[]): Promise<T[]> {
    return this.genericRepository.save(addDtos);
  }

  async findOne(id: T['id']): Promise<T> {
    const entity = await this.genericRepository.findOne({
      where: { id } as FindOptionsWhere<T>,
      withDeleted: true,
    });
    if (!entity) throw new NotFoundException();
    return entity;
  }

  async findOneNullable(id: T['id']): Promise<T | null> {
    return this.genericRepository.findOne({
      where: { id } as FindOptionsWhere<T>,
      withDeleted: true,
    });
  }

  findBy(
    where: FindOptionsWhere<T>,
    options?: FindManyOptions<T>,
  ): Promise<T[]> {
    return this.genericRepository.find({
      where,
      withDeleted: true,
      ...options,
    });
  }

  findOneBy(
    where: FindOptionsWhere<T>,
    options?: FindManyOptions<T>,
  ): Promise<T | null> {
    return this.genericRepository.findOne({
      where,
      withDeleted: true,
      ...options,
    });
  }

  count(where?: FindOptionsWhere<T>): Promise<number> {
    return this.genericRepository.count({
      where,
      withDeleted: true,
    });
  }

  async update(id: T['id'], updateDto: DeepPartial<T>): Promise<T> {
    const preloaded = await this.genericRepository.preload({
      ...updateDto,
      id,
    });
    if (!preloaded) throw new NotFoundException();
    return this.genericRepository.save(preloaded);
  }

  async softdelete(id: T['id']): Promise<UpdateResult> {
    const result = await this.genericRepository.softDelete(id);
    if (!result.affected) throw new NotFoundException();
    return result;
  }

  async restore(id: T['id']): Promise<UpdateResult> {
    const result = await this.genericRepository.restore(id);
    if (!result.affected) throw new NotFoundException();
    return result;
  }

  async delete(id: T['id']): Promise<void> {
    const result = await this.genericRepository.delete(id);
    if (!result.affected) throw new NotFoundException();
  }

  async exists(id: T['id']): Promise<boolean> {
    const cnt = await this.genericRepository.count({
      where: { id } as FindOptionsWhere<T>,
      withDeleted: true,
    });
    return cnt > 0;
  }

  async paginate(
    skip: number = 0,
    take: number = 10,
    options?: FindManyOptions<T>,
  ): Promise<{ items: T[]; total: number }> {
    const [items, total] = await this.genericRepository.findAndCount({
      skip,
      take,
      withDeleted: true,
      ...options,
    });
    return { items, total };
  }
}
