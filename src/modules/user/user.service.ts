import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { User } from './user.entity';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getOrCreateUser({ chatId, telegramUserId }: RegisterDto): Promise<{ action: string; user: User }> {
    let action: string = 'get';
    let user = await this.userRepository.findOne({
      where: { chatId },
    });

    if (!user) {
      user = this.userRepository.create({
        chatId,
        telegramUserId,
      });
      await this.userRepository.save(user);
      action = 'create';
    }

    return { action, user };
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      select: {
        id: true,
        createdAt: true,
        chatId: true,
        telegramUserId: true,
      },
    });
  }
}
