import { Address } from 'viem';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, EntityManager, Repository } from 'typeorm';

import { User } from './user.entity';
import { UserToken } from './user-token.entity';
import { RegisterDto } from './dto/register.dto';
import { RedisService } from '@modules/redis/redis.service';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { DeleteConditions, Network } from '@src/types/types';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserToken)
    private readonly userTokenRepository: Repository<UserToken>,
    private readonly blockchainService: BlockchainService,
    private readonly redisService: RedisService,
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

    const savedToken = await this.userTokenRepository.save(token);

    const tokens = [...user.tokens, savedToken];

    return tokens;
  }

  async removeToken({
    userId,
    chatId,
    address,
    network,
  }: {
    userId: number;
    chatId: number;
    address?: Address;
    network?: Network;
  }): Promise<DeleteResult> {
    const userSession = await this.redisService.getSessionData(chatId.toString());

    if (!userSession || !userSession.userId || !userSession.chatId) {
      throw new Error('Пользователь не найден');
    }

    const { tokens } = userSession;

    if (!tokens?.length) {
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

    const deleteResult = await this.userTokenRepository.delete(deleteConditions);
    const user = await this.findById({ id: userId });

    await this.redisService.setSessionData(chatId.toString(), {
      ...userSession,
      tokens: user?.tokens || [],
    });

    return deleteResult;
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
      },
    });

    return user;
  }
}
