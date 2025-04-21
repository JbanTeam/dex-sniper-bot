import Redis from 'ioredis';
import { Injectable } from '@nestjs/common';

import {
  Network,
  SessionUser,
  SessionSubscription,
  SessionUserToken,
  SessionWallet,
  Address,
  TempReplication,
  SessionReplication,
} from '@src/types/types';
import {
  SubscriptionParams,
  AddTokenParams,
  RemoveTokenParams,
  DeleteTokensParams,
  FilterTokensParams,
  CleanTokenSetsParams,
} from './types';
import { BotError } from '@src/errors/BotError';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { CachedContractsType } from '@modules/blockchain/viem/types';

@Injectable()
export class RedisService {
  private readonly redisClient: Redis;
  private readonly nodeEnv: string;
  private readonly notProd: boolean;

  constructor(private readonly constants: ConstantsProvider) {
    this.nodeEnv = this.constants.NODE_ENV;
    this.notProd = this.nodeEnv !== 'production';

    this.redisClient = new Redis({
      host: this.constants.REDIS_HOST,
      port: parseInt(this.constants.REDIS_PORT),
      password: this.constants.REDIS_PASSWORD,
      username: this.constants.REDIS_USERNAME,
      db: parseInt(this.constants.REDIS_DB),
    });
  }

  async addUser(userData: SessionUser) {
    const { chatId } = userData;
    const userDataArr = Object.entries(userData);

    await Promise.all(
      userDataArr.map(async ([key, value]) => {
        if (value) {
          if (typeof value === 'object' || Array.isArray(value)) value = JSON.stringify(value);
          await this.redisClient.hset(`user:${chatId}`, key, value);
        }
      }),
    );

    await this.redisClient.expire(`user:${chatId}`, 3600 * 24 * 30);
    await this.redisClient.sadd('users', chatId);
  }

  async addToken({ chatId, token, tokens, prefix }: AddTokenParams) {
    const exists = await this.existsInSet(`${prefix}s:${token.network}`, token.address);

    const pipe = this.redisClient.pipeline();
    pipe.hset(`user:${chatId}`, `${prefix}s`, JSON.stringify(tokens));
    pipe.hmset(`${prefix}:${token.address}:${chatId}`, token);
    pipe.sadd(`${prefix}s:${token.network}`, token.address);

    if (!exists) pipe.hmset(`${prefix}:${token.address}`, token);

    await pipe.exec();
  }

  async removeToken({ userSession, deleteConditions }: RemoveTokenParams) {
    const { chatId } = userSession;

    const { remainingTokens, replications, deletedTokens, deletedTestTokens } = this.filterTokens({
      userSession,
      deleteConditions,
    });

    const pipe = this.redisClient.pipeline();

    this.deleteTokens({ pipe, chatId, tokens: remainingTokens.tokens, deletedTokens, prefix: 'token' });
    pipe.hset(`user:${chatId}`, 'replications', JSON.stringify(replications));

    if (this.notProd) {
      this.deleteTokens({
        pipe,
        chatId,
        tokens: remainingTokens.testTokens,
        deletedTokens: deletedTestTokens,
        prefix: 'testToken',
      });
    }

    await pipe.exec();
    await this.cleanTokenSets({ deletedTokens, prefix: 'token' });
    if (this.notProd) {
      await this.cleanTokenSets({ deletedTokens: deletedTestTokens, prefix: 'testToken' });
    }
  }

  async addSubscription({ chatId, subscription, subscriptions }: SubscriptionParams) {
    const pipe = this.redisClient.pipeline();
    pipe.hset(`user:${chatId}`, 'subscriptions', JSON.stringify(subscriptions));
    pipe.sadd(`subscriptions:${subscription.network}`, subscription.address);
    pipe.hmset(`sub:${subscription.address}:${chatId}`, subscription);

    await pipe.exec();
  }

  async removeSubscription({ chatId, subscriptions, subscription, replications }: SubscriptionParams) {
    const curSubscriptions = subscriptions.filter(sub => sub.id !== subscription.id);

    const pipe = this.redisClient.pipeline();

    if (replications?.length) {
      const curReplications = replications.filter(rep => rep.subscriptionId !== subscription.id);
      pipe.hset(`user:${chatId}`, `replications`, JSON.stringify(curReplications));
    }

    pipe.hset(`user:${chatId}`, `subscriptions`, JSON.stringify(curSubscriptions));

    pipe.del(`sub:${subscription.address}:${chatId}`);

    await pipe.exec();

    const subExists = await this.hasKeysWithPattern(`sub:${subscription.address}:*`);
    if (!subExists) {
      pipe.srem(`subscriptions:${subscription.network}`, subscription.address);
    }

    await pipe.exec();
  }

  async setUserField(chatId: number, key: string, value: string) {
    await this.redisClient.hset(`user:${chatId}`, key, value);
  }

  async setUserFields(chatId: number, fields: object) {
    await this.redisClient.hmset(`user:${chatId}`, fields);
  }

  async addSubscriptionToSet(subscriptionAddress: Address) {
    await this.redisClient.sadd('subscriptions', subscriptionAddress);
  }

  async addTokenToSet({ tokenAddress, network }: { tokenAddress: Address; network: Network }) {
    await this.redisClient.sadd(`tokens:${network}`, tokenAddress);
  }

  async addTestTokenToSet({ tokenAddress, network }: { tokenAddress: Address; network: Network }) {
    await this.redisClient.sadd(`testTokens:${network}`, tokenAddress);
  }

  async existsInSet(setName: string, value: string) {
    return await this.redisClient.sismember(setName, value);
  }

  async isSetEmpty(key: string): Promise<boolean> {
    const count = await this.redisClient.scard(key);
    return count === 0;
  }

  async getUser(chatId: number) {
    const userData = await this.redisClient.hgetall(`user:${chatId}`);
    if (!userData) throw new BotError('User not found', 'Пользователь не найден', 404);

    return this.parseData<SessionUser>(userData);
  }

  async getHashFeilds(key: string) {
    return await this.redisClient.hgetall(key);
  }

  async setHashFeilds(key: string, fields: object) {
    return await this.redisClient.hmset(key, fields);
  }

  async getUserId(chatId: number) {
    const userData = await this.redisClient.hget(`user:${chatId}`, 'userId');
    if (!userData) return null;

    return Number(userData);
  }
  async getUserChatId(chatId: number) {
    const userData = await this.redisClient.hget(`user:${chatId}`, 'chatId');
    if (!userData) return null;

    return Number(userData);
  }

  async getTempToken(chatId: number) {
    return await this.redisClient.hget(`user:${chatId}`, 'tempToken');
  }

  async getTempWallet(chatId: number) {
    return await this.redisClient.hget(`user:${chatId}`, 'tempWallet');
  }

  async getTempReplication(chatId: number) {
    const tempReplicationData = await this.redisClient.hget(`user:${chatId}`, 'tempReplication');
    if (!tempReplicationData)
      throw new BotError('Error getting temp replication', 'Ошибка установления повтора сделок', 404);
    return this.parseData<TempReplication>(JSON.parse(tempReplicationData));
  }

  async getTempSendTokens(chatId: number) {
    return await this.redisClient.hget(`user:${chatId}`, 'tempSendTokens');
  }

  async getWallets(chatId: number): Promise<SessionWallet[] | null> {
    const data = await this.redisClient.hget(`user:${chatId}`, 'wallets');
    if (!data) return null;
    return JSON.parse(data) as SessionWallet[];
  }

  async getTokens(chatId: number, prefix: string): Promise<SessionUserToken[] | null> {
    const data = await this.redisClient.hget(`user:${chatId}`, prefix);
    if (!data) return null;
    return JSON.parse(data) as SessionUserToken[];
  }

  async getToken(tokenAddress: Address, prefix: string): Promise<SessionUserToken | null> {
    const data = await this.redisClient.hgetall(`${prefix}:${tokenAddress}`);
    if (!data) return null;
    return this.parseData<SessionUserToken>(data);
  }

  async getSubscriptions(chatId: number): Promise<SessionSubscription[] | null> {
    const data = await this.redisClient.hget(`user:${chatId}`, 'subscriptions');
    if (!data) return null;
    return JSON.parse(data) as SessionSubscription[];
  }

  async getReplications(chatId: number): Promise<SessionReplication[] | null> {
    const data = await this.redisClient.hget(`user:${chatId}`, 'replications');
    if (!data) return null;
    return JSON.parse(data) as SessionReplication[];
  }

  async getCachedContracts(): Promise<CachedContractsType> {
    const data = await this.redisClient.hgetall('cachedContracts');
    if (!data) return {} as CachedContractsType;
    return this.parseData<CachedContractsType>(data);
  }

  async getAllUsers() {
    const usersIds = await this.redisClient.smembers('users');

    const users: SessionUser[] = await Promise.all(
      usersIds.map(async userId => {
        const userData = await this.getUser(Number(userId));
        return userData;
      }),
    );

    return users;
  }

  async getUsersSet() {
    const usersIds = await this.redisClient.smembers('users');
    return usersIds;
  }
  async getTokensSet(network: Network, prefix: string) {
    const tokens = await this.redisClient.smembers(`${prefix}:${network}`);
    return tokens;
  }

  async getSubscriptionsSet(network: Network) {
    return await this.redisClient.smembers(`subscriptions:${network}`);
  }

  async findTestTokenById(id: string): Promise<SessionUserToken | null> {
    const pattern = 'testToken:*';
    let cursor = '0';

    do {
      const reply = await this.redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 10);
      cursor = reply[0];
      const keys = reply[1];

      for (const key of keys) {
        const tokenId = await this.redisClient.hget(key, 'id');
        if (tokenId === id) {
          const data = await this.redisClient.hgetall(key);
          return this.parseData<SessionUserToken>(data);
        }
      }
    } while (cursor !== '0');

    return null;
  }

  private filterTokens({ userSession, deleteConditions }: FilterTokensParams) {
    const { address, network } = deleteConditions;
    const deletedTokens: SessionUserToken[] = [];
    const deletedTestTokens: SessionUserToken[] = [];

    const tokens = userSession.tokens.filter(token => {
      const shouldDelete =
        (!address && !network) || (address && token.address === address) || (network && token.network === network);
      if (shouldDelete) deletedTokens.push(token);
      return !shouldDelete;
    });

    const tokenIds = new Set(tokens.map(t => t.id));
    let testTokens = userSession.testTokens;
    if (this.notProd && testTokens) {
      testTokens = testTokens.filter(token => {
        if (!tokenIds.has(token.id)) {
          deletedTestTokens.push(token);
          return false;
        }
        return true;
      });
    }

    const replications = userSession.replications.filter(rep => {
      return tokenIds.has(rep.tokenId);
    });

    return {
      remainingTokens: { tokens, testTokens },
      replications,
      deletedTokens,
      deletedTestTokens,
    };
  }

  private deleteTokens({ pipe, chatId, tokens, deletedTokens, prefix }: DeleteTokensParams) {
    pipe.hset(`user:${chatId}`, `${prefix}s`, JSON.stringify(tokens || []));

    for (const token of deletedTokens) {
      pipe.del(`${prefix}:${token.address}:${chatId}`);
    }
  }

  private async cleanTokenSets({ deletedTokens, prefix }: CleanTokenSetsParams) {
    const pipe = this.redisClient.pipeline();

    for (const token of deletedTokens) {
      const tokenExists = await this.hasKeysWithPattern(`${prefix}:${token.address}:*`);
      if (!tokenExists) {
        pipe.del(`${prefix}:${token.address}`);
        pipe.srem(`${prefix}s:${token.network}`, token.address);
      }
    }

    await pipe.exec();
  }

  async hasKeysWithPattern(pattern: string): Promise<boolean> {
    let cursor = '0';

    do {
      const [newCursor, keys] = await this.redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      if (keys.length > 0) {
        return true;
      }
      cursor = newCursor;
    } while (cursor !== '0');

    return false;
  }

  private parseData<T>(data: Record<string, string>): T {
    const parsedObject: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (/^-?\d+$/.test(value)) {
        parsedObject[key] = Number(value);
      } else if (value === 'true' || value === 'false') {
        parsedObject[key] = value === 'true';
      } else if (value.startsWith('{') || value.startsWith('[')) {
        try {
          parsedObject[key] = JSON.parse(value) as unknown;
        } catch {
          parsedObject[key] = value;
        }
      } else {
        parsedObject[key] = value;
      }
    }

    return parsedObject as T;
  }
}
