import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';

import { User } from './user.entity';
import { UserToken } from './user-token.entity';
import { RegisterDto } from './dto/register.dto';
import { BotError } from '@src/errors/BotError';
import { isNetwork } from '@src/types/typeGuards';
import { RedisService } from '@modules/redis/redis.service';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { Network, SessionUserToken } from '@src/types/types';
import {
  AddTokenParams,
  CreateTestTokenParams,
  CreateTokenEntityParams,
  DeleteConditions,
  RemoveTokenParams,
  UpdateTokenStorageParams,
} from './types';
import { ConstantsProvider } from '@modules/constants/constants.provider';

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
    private readonly constants: ConstantsProvider,
  ) {
    this.nodeEnv = this.constants.NODE_ENV;
    this.notProd = this.nodeEnv !== 'production';
  }

  async getOrCreateUser({ chatId }: RegisterDto): Promise<{ action: string; user: User | null }> {
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

  async addToken({ userSession, address, network }: AddTokenParams): Promise<{ tokens: SessionUserToken[] }> {
    this.validateTokenAddition({ userSession, address, network });

    const { tokens, sessionToken, existsTokenId } = await this.createAndSaveToken({ userSession, address, network });

    if (this.notProd) {
      await this.createTestToken({ userSession, sessionToken, existsTokenId });
    }

    return { tokens };
  }

  async getTokens(chatId: number): Promise<string> {
    const userSession = await this.redisService.getUser(chatId);
    if (!userSession.tokens.length) {
      throw new BotError('You have no saved tokens', 'У вас нет сохраненных токенов', 404);
    }

    let reply = `<u>Ваши токены:</u>\n`;

    userSession.tokens.forEach((token, index) => {
      reply += `${index + 1}. <b>Сеть:</b> <u>${token.network}</u> / <b>Токен:</b> <u>${token.name} (${token.symbol})</u>\n<code>${token.address}</code>\n\n`;
    });

    return reply;
  }

  async removeToken({ chatId, address, network }: RemoveTokenParams): Promise<void> {
    const userSession = await this.redisService.getUser(chatId);

    if (!userSession) throw new BotError('User not found', 'Пользователь не найден', 404);
    if (!userSession.tokens.length) {
      throw new BotError('You have no saved tokens', 'У вас нет сохраненных токенов', 404);
    }

    if (network && !userSession.tokens.some(t => t.network === network)) {
      throw new BotError('Tokens not found in this network', 'Токены не найдены в указанной сети', 404);
    }

    if (address && !userSession.tokens.some(t => t.address === address)) {
      throw new BotError('Token not found', 'Токен не найден', 404);
    }

    const deleteConditions: DeleteConditions = { user: { id: userSession.userId } };

    if (address) {
      deleteConditions.address = address;
    } else if (network) {
      deleteConditions.network = network;
    }

    if (!network) {
      network = userSession.tokens.find(t => t.address === address)?.network;
    }

    const deleteResult = await this.userTokenRepository.delete(deleteConditions);

    if (!deleteResult.affected) throw new BotError('Tokens not deleted', 'Токены не удалены', 400);

    await this.redisService.removeToken({ userSession, deleteConditions });
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

  private validateTokenAddition({ userSession, address, network }: AddTokenParams) {
    if (userSession.tokens.some(t => t.address === address && t.network === network)) {
      throw new BotError('Token already added', 'Токен уже добавлен', 400);
    }

    if (userSession.tokens.filter(t => t.network === network).length >= 5) {
      throw new BotError(
        'You can add only 5 tokens per network',
        'Максимум можно добавить 5 токенов на одну сеть',
        400,
      );
    }
  }

  private async createAndSaveToken({ userSession, address, network }: AddTokenParams) {
    const { name, symbol, decimals, existsTokenId } = await this.getTokenData({ address, network });

    const token = this.createTokenEntity({ userSession, address, network, name, symbol, decimals });
    const savedToken = await this.userTokenRepository.save(token);

    const sessionToken = this.prepareSessionToken(savedToken);
    const tokens = [...userSession.tokens, sessionToken];

    await this.updateTokenStorage({ chatId: userSession.chatId, tokens, token: sessionToken });

    return { tokens, sessionToken, existsTokenId };
  }

  private async getTokenData({ address, network }: Omit<AddTokenParams, 'userSession'>) {
    const exists = await this.redisService.existsInSet(`tokens:${network}`, address);

    if (exists) {
      const existsToken = await this.redisService.getHashFeilds(`token:${address}`);
      return {
        name: existsToken.name,
        symbol: existsToken.symbol,
        decimals: Number(existsToken.decimals),
        existsTokenId: existsToken.id,
      };
    }

    const tokenData = await this.blockchainService.checkToken({ address, network });
    return {
      name: tokenData.name,
      symbol: tokenData.symbol,
      decimals: tokenData.decimals,
      existsTokenId: '',
    };
  }

  private createTokenEntity(tokenEntityParams: CreateTokenEntityParams) {
    const { userSession, ...createParams } = tokenEntityParams;
    return this.userTokenRepository.create({
      ...createParams,
      user: { id: userSession.userId },
    });
  }

  private prepareSessionToken(savedToken: UserToken): SessionUserToken {
    const sessionToken = { ...savedToken, user: undefined };
    delete sessionToken.user;
    return sessionToken;
  }

  private async updateTokenStorage({ chatId, tokens, token, isTest = false }: UpdateTokenStorageParams) {
    const prefix = isTest ? 'testToken' : 'token';

    await this.redisService.addToken({ chatId, token, tokens, prefix });
  }

  private async createTestToken({ userSession, sessionToken, existsTokenId }: CreateTestTokenParams) {
    let testToken = existsTokenId ? await this.redisService.findTestTokenById(existsTokenId) : null;

    if (!testToken) {
      const wallet = userSession.wallets.find(w => w.network === sessionToken.network);
      if (!wallet) throw new BotError('Wallet not found', 'Кошелек для сети не найден', 404);

      testToken = await this.blockchainService.deployTestContract({ wallet, token: sessionToken });
    } else {
      testToken.id = sessionToken.id;
    }

    const testTokens = userSession.testTokens ? [...userSession.testTokens, testToken] : [testToken];

    await this.updateTokenStorage({ chatId: userSession.chatId, tokens: testTokens, token: testToken, isTest: true });
  }
}
