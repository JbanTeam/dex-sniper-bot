import { Repository } from 'typeorm';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { UserToken } from './user-token.entity';
import { BotError } from '@src/errors/BotError';
import { SessionUserToken } from '@src/types/types';
import { TokenData } from '@modules/blockchain/types';
import { RedisService } from '@modules/redis/redis.service';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import {
  AddTokenParams,
  CreateAndSaveTokenReturnType,
  CreateTestTokenParams,
  CreateTokenEntityParams,
  DeleteConditions,
  RemoveTokenParams,
  UpdateTokenStorageParams,
} from '@modules/user-token/types';
import { MONITOR_DEX_EVENT } from '@src/utils/constants';

@Injectable()
export class UserTokenService {
  constructor(
    @InjectRepository(UserToken)
    private readonly userTokenRepository: Repository<UserToken>,
    private readonly blockchainService: BlockchainService,
    private readonly redisService: RedisService,
    private readonly constants: ConstantsProvider,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async addToken({ userSession, address, network }: AddTokenParams): Promise<string> {
    this.validateTokenAddition({ userSession, address, network });

    const { tokens, sessionToken, existsTokenId, pairAddresses } = await this.createAndSaveToken({
      userSession,
      address,
      network,
    });

    if (pairAddresses) {
      const { pairAddress, token0, token1 } = pairAddresses;
      await this.redisService.addPair({ network, pairAddress, token0, token1, prefix: 'pair' });
    }

    if (this.constants.notProd) {
      await this.createTestToken({ userSession, sessionToken, existsTokenId });
    }

    if (pairAddresses) this.eventEmitter.emit(MONITOR_DEX_EVENT, { network });

    return this.prepareTokensReply(tokens);
  }

  async getTokens(chatId: number): Promise<string> {
    const userSession = await this.redisService.getUser(chatId);
    if (!userSession.tokens.length) {
      throw new BotError('You have no saved tokens', 'У вас нет сохраненных токенов', HttpStatus.NOT_FOUND);
    }

    return this.prepareTokensReply(userSession.tokens);
  }

  async removeToken({ chatId, address, network }: RemoveTokenParams): Promise<void> {
    const userSession = await this.redisService.getUser(chatId);
    if (!userSession) throw new BotError('User not found', 'Пользователь не найден', HttpStatus.NOT_FOUND);
    if (!userSession.tokens.length) {
      throw new BotError('You have no saved tokens', 'У вас нет сохраненных токенов', HttpStatus.NOT_FOUND);
    }

    if (network && !userSession.tokens.some(t => t.network === network)) {
      throw new BotError(
        'Tokens not found in this network',
        'Токены не найдены в указанной сети',
        HttpStatus.NOT_FOUND,
      );
    }

    if (address && !userSession.tokens.some(t => t.address === address)) {
      throw new BotError('Token not found', 'Токен не найден', HttpStatus.NOT_FOUND);
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

    if (!deleteResult.affected) throw new BotError('Tokens not deleted', 'Токены не удалены', HttpStatus.BAD_REQUEST);

    await this.redisService.removeToken({ userSession, deleteConditions });
  }

  private prepareTokensReply(tokens: SessionUserToken[]): string {
    const groupedTokens = tokens.reduce(
      (acc, rep) => {
        const exchange = this.constants.chains[rep.network].exchange;
        const key = `${exchange} (${rep.network})`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(rep);
        return acc;
      },
      {} as Record<string, SessionUserToken[]>,
    );

    let reply = `<u>Ваши токены:</u>\n`;

    Object.entries(groupedTokens).forEach(([, tokens]) => {
      tokens.forEach((token, index) => {
        reply += `${index + 1}. <b>Сеть:</b> <u>${token.network}</u> / <b>Токен:</b> <u>${token.name} (${token.symbol})</u>\n<code>${token.address}</code>\n`;
      });
      reply += '\n';
    });

    return reply;
  }

  private validateTokenAddition({ userSession, address, network }: AddTokenParams): void {
    if (userSession.tokens.some(t => t.address === address && t.network === network)) {
      throw new BotError('Token already added', 'Токен уже добавлен', HttpStatus.BAD_REQUEST);
    }

    if (userSession.tokens.filter(t => t.network === network).length >= 5) {
      throw new BotError(
        'You can add only 5 tokens per network',
        'Максимум можно добавить 5 токенов на одну сеть',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async createAndSaveToken({
    userSession,
    address,
    network,
  }: AddTokenParams): Promise<CreateAndSaveTokenReturnType> {
    const { name, symbol, decimals, existsTokenId, pairAddresses } = await this.getTokenData({
      address,
      network,
    });

    const token = this.createTokenEntity({ userSession, address, network, name, symbol, decimals });
    const savedToken = await this.userTokenRepository.save(token);

    const sessionToken = this.prepareSessionToken(savedToken);
    const tokens = [...userSession.tokens, sessionToken];

    await this.updateTokenStorage({ chatId: userSession.chatId, tokens, token: sessionToken });

    return { tokens, sessionToken, existsTokenId, pairAddresses };
  }

  private async getTokenData({ address, network }: Omit<AddTokenParams, 'userSession'>): Promise<TokenData> {
    const exists = await this.redisService.existsInSet(`tokens:${network}`, address);

    if (exists) {
      const existsToken = await this.redisService.getHashFeilds(`token:${address}`);
      const { name, symbol, decimals, id } = existsToken;
      return { name, symbol, decimals: Number(decimals), existsTokenId: id, pairAddresses: null };
    }

    const tokenData = await this.blockchainService.checkToken({ address, network });
    return { ...tokenData, existsTokenId: '' };
  }

  private createTokenEntity(tokenEntityParams: CreateTokenEntityParams): UserToken {
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

  private async updateTokenStorage({ chatId, tokens, token, isTest = false }: UpdateTokenStorageParams): Promise<void> {
    const prefix = isTest ? 'testToken' : 'token';

    await this.redisService.addToken({ chatId, token, tokens, prefix });
  }

  private async createTestToken({ userSession, sessionToken, existsTokenId }: CreateTestTokenParams): Promise<void> {
    let testToken = existsTokenId ? await this.redisService.findTestTokenById(existsTokenId) : null;

    if (!testToken) {
      const wallet = userSession.wallets.find(w => w.network === sessionToken.network);
      if (!wallet) throw new BotError('Wallet not found', 'Кошелек для сети не найден', HttpStatus.NOT_FOUND);

      const testTokenData = await this.blockchainService.createTestToken({ wallet, token: sessionToken });
      const { token, pairAddresses } = testTokenData;
      const { pairAddress, token0, token1 } = pairAddresses;
      const { network } = token;
      testToken = token;

      await this.redisService.addPair({ network, pairAddress, token0, token1, prefix: 'testPair' });
    } else {
      testToken.id = sessionToken.id;
    }

    const testTokens = userSession.testTokens ? [...userSession.testTokens, testToken] : [testToken];

    await this.updateTokenStorage({ chatId: userSession.chatId, tokens: testTokens, token: testToken, isTest: true });
  }
}
