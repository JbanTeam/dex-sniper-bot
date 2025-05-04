import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';

import { User } from './user.entity';
import { isNetwork } from '@src/types/typeGuards';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { Network } from '@src/types/types';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly blockchainService: BlockchainService,
  ) {}

  async getOrCreateUser(chatId: number): Promise<{ action: string; user: User | null }> {
    let action: string = 'get';
    let user = await this.findById({ chatId });

    if (!user) {
      user = await this.userRepository.manager.transaction(async entityManager => {
        const createdUser = entityManager.create(User, {
          chatId,
        });

        const savedUser = await entityManager.save(createdUser);

        const networksArr = Object.keys(Network);
        await Promise.all(
          networksArr.map(network => {
            isNetwork(network);
            return this.blockchainService.createWallet({
              userId: savedUser.id,
              network: network,
              entityManager,
            });
          }),
        );

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
      relations: ['wallets', 'tokens', 'subscriptions', 'replications'],
      select: {
        id: true,
        createdAt: true,
        chatId: true,
        tokens: {
          id: true,
          address: true,
          network: true,
          name: true,
          symbol: true,
          decimals: true,
        },
        wallets: {
          id: true,
          address: true,
          network: true,
        },
        subscriptions: {
          id: true,
          network: true,
          address: true,
        },
        replications: {
          id: true,
          network: true,
          buy: true,
          sell: true,
          token: { id: true },
          subscription: { id: true },
        },
      },
    });

    return user;
  }
}
