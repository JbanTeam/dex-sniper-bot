import { Address } from 'viem';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, EntityManager, Repository } from 'typeorm';

import { User } from './user.entity';
import { RegisterDto } from './dto/register.dto';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { UserToken } from './user-token.entity';
import { DeleteConditions, Network } from '@src/types/types';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserToken)
    private readonly userTokenRepository: Repository<UserToken>,
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

  async addToken({
    userId,
    address,
    network,
  }: {
    userId: number;
    address: Address;
    network: Network;
  }): Promise<UserToken[]> {
    const user = await this.findById({ id: userId });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.tokens.some(t => t.address === address && t.network === network)) {
      throw new Error('Токен уже добавлен');
    }

    const networkTokens = user.tokens.filter(t => t.network === network);
    if (networkTokens.length >= 5) {
      throw new Error('Максимум можно добавить 5 токенов на одну сеть');
    }

    const { name, symbol, decimals } = await this.blockchainService.checkToken({ address, network });

    const token = this.userTokenRepository.create({
      address,
      network,
      user,
      name,
      symbol,
      decimals,
    });

    await this.userTokenRepository.save(token);

    const tokens = [...user.tokens, token];

    return tokens;
  }

  async removeToken({
    userId,
    address,
    network,
  }: {
    userId: number;
    address?: Address;
    network?: Network;
  }): Promise<DeleteResult> {
    const user = await this.findById({ id: userId });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { tokens } = user;

    if (!tokens.length) {
      throw new Error('У вас нет сохраненных токенов');
    }

    if (network && !tokens.some(t => t.network === network)) {
      throw new Error('Токены не найдены в указанной сети');
    }

    if (address && !tokens.some(t => t.address === address)) {
      throw new Error('Токен не найден');
    }

    const deleteConditions: DeleteConditions = { user: { id: userId } };

    if (address) {
      deleteConditions.address = address;
    } else if (network) {
      deleteConditions.network = network;
    }

    return this.userTokenRepository.delete(deleteConditions);
  }

  async findById(where: { id?: number; chatId?: number }, entityManager?: EntityManager): Promise<User | null> {
    const manager = entityManager || this.userRepository.manager;
    const user = await manager.findOne(User, {
      where: { ...where },
      relations: ['wallets', 'tokens'],
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
