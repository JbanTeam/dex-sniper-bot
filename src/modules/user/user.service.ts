import { Address } from 'viem';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { EntityManager, Repository } from 'typeorm';

import { User } from './user.entity';
import { UserToken } from './user-token.entity';
import { RegisterDto } from './dto/register.dto';
import { RedisService } from '@modules/redis/redis.service';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { DeleteConditions, Network, NewAddedTokenParams, SessionData, SessionUserToken } from '@src/types/types';

@Injectable()
export class UserService {
  private readonly nodeEnv: string;
  private readonly notProd: boolean;
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserToken)
    private readonly userTokenRepository: Repository<UserToken>,
    private readonly blockchainService: BlockchainService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    this.notProd = this.nodeEnv !== 'production';
  }

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
    userSession,
    address,
    network,
  }: {
    userSession: SessionData;
    address: Address;
    network: Network;
  }): Promise<{ tokens: SessionUserToken[] }> {
    if (userSession.tokens.some(t => t.address === address && t.network === network)) {
      throw new Error('Токен уже добавлен');
    }

    const networkTokens = userSession.tokens.filter(t => t.network === network);
    if (networkTokens.length >= 5) {
      throw new Error('Максимум можно добавить 5 токенов на одну сеть');
    }

    const { name, symbol, decimals } = await this.blockchainService.checkToken({ address, network });

    const token = this.userTokenRepository.create({
      address,
      network,
      user: { id: userSession.userId },
      name,
      symbol,
      decimals,
    });

    const savedToken = await this.userTokenRepository.save(token);
    const sessionToken = { ...savedToken, user: undefined };
    delete sessionToken.user;
    const tokens = [...userSession.tokens, sessionToken];

    if (this.notProd) {
      const createdTestToken = await this.blockchainService.deployTestContract({
        wallet: userSession.wallets.find(w => w.network === network)!,
        token: sessionToken,
      });
      const testTokens = userSession?.testTokens?.length
        ? [...userSession.testTokens, createdTestToken]
        : [createdTestToken];

      await this.checkNewAddedToken({
        chatId: userSession.chatId,
        tokens: testTokens,
        token: createdTestToken,
        isTest: true,
      });
    }

    await this.checkNewAddedToken({ chatId: userSession.chatId, tokens, token: sessionToken });

    return { tokens };
  }

  async removeToken({
    chatId,
    address,
    network,
  }: {
    chatId: number;
    address?: Address;
    network?: Network;
  }): Promise<void> {
    const userSession = await this.redisService.getUser(chatId);

    if (!userSession) throw new Error('Пользователь не найден');
    if (!userSession.tokens.length) throw new Error('У вас нет сохраненных токенов');

    if (network && !userSession.tokens.some(t => t.network === network)) {
      throw new Error('Токены не найдены в указанной сети');
    }

    if (address && !userSession.tokens.some(t => t.address === address)) {
      throw new Error('Токен не найден');
    }

    const deleteConditions: DeleteConditions = { user: { id: userSession.userId } };

    if (address) {
      deleteConditions.address = address;
    } else if (network) {
      deleteConditions.network = network;
    }

    const deleteResult = await this.userTokenRepository.delete(deleteConditions);

    if (!deleteResult.affected) throw new Error('Токены не удалены');

    await this.redisService.removeToken({ userSession, deleteConditions });

    this.eventEmitter.emit('monitorTokens', { network });
  }

  async findById(where: { id?: number; chatId?: number }, entityManager?: EntityManager): Promise<User | null> {
    const manager = entityManager || this.userRepository.manager;
    const user = await manager.findOne(User, {
      where: { ...where },
      relations: ['wallets', 'tokens', 'subscriptions'],
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
        subscriptions: {
          id: true,
          network: true,
          address: true,
        },
      },
    });

    return user;
  }

  private async checkNewAddedToken({ chatId, tokens, token, isTest = false }: NewAddedTokenParams): Promise<void> {
    const prefix = isTest ? 'testToken' : 'token';
    const setName = `${prefix}s`;

    const exists = await this.redisService.existsInSet(setName, token.address);

    await this.redisService.addToken({ chatId, token, tokens, prefix });

    if (!exists && isTest === this.notProd) {
      this.eventEmitter.emit('monitorTokens', { network: token.network });
    }
  }
}
