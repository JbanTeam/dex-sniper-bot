import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { UserEntity } from './user.entity';
// import { RegisterDto } from '@modules/auth/dto/register.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  // async create(registerDto: RegisterDto): Promise<Pick<UserEntity, 'id' | 'name' | 'email' | 'createdAt'>> {
  //   const user = this.userRepository.create(registerDto);
  //   const savedUser = await this.userRepository.save(user);
  //   const returnUser: Pick<UserEntity, 'id' | 'name' | 'email' | 'createdAt'> = {
  //     id: savedUser.id,
  //     name: savedUser.name,
  //     email: savedUser.email,
  //     createdAt: savedUser.createdAt,
  //   };
  //   return returnUser;
  // }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({
      where: { email },
      select: {
        id: true,
        name: true,
        createdAt: true,
        password: true,
        email: true,
      },
    });
  }

  async findById(id: number): Promise<UserEntity | null> {
    return this.userRepository.findOne({
      where: { id },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });
  }
}
