import { EntityManager, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { User } from './user.entity';
import { RegisterDto } from './dto/register.dto';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { Network } from '@src/types/types';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly blockchainService: BlockchainService,
  ) {}

  async getOrCreateUser({ chatId, telegramUserId }: RegisterDto): Promise<{ action: string; user: User | null }> {
    let action: string = 'get';
    let user = await this.findById({ chatId });

    if (!user) {
      user = await this.userRepository.manager.transaction(async entityManager => {
        const createdUser = entityManager.create(User, {
          chatId,
          telegramUserId,
        });

        const savedUser = await entityManager.save(createdUser);

        await this.blockchainService.createWallet({
          userId: savedUser.id,
          network: Network.BSC,
          entityManager,
        });

        await this.blockchainService.createWallet({
          userId: savedUser.id,
          network: Network.POLYGON,
          entityManager,
        });

        return this.findById({ id: savedUser.id }, entityManager);
      });
      action = 'create';
    }

    return { action, user };
  }

  async findById(where: { id?: number; chatId?: number }, entityManager?: EntityManager): Promise<User | null> {
    const manager = entityManager || this.userRepository.manager;
    const user = await manager.findOne(User, {
      where: { ...where },
      relations: ['wallets'],
      select: {
        id: true,
        createdAt: true,
        chatId: true,
        telegramUserId: true,
      },
    });

    return user;
  }
}
