import Redis from 'ioredis';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Network, SessionData, SessionSubscription, SessionUserToken, SessionWallet } from '@src/types/types';
import { Address } from 'viem';
import {
  SubscriptionParams,
  AddTokenParams,
  RemoveTokenParams,
  DeleteTokensParams,
  FilterTokensParams,
  CleanTokenSetsParams,
} from './types';

@Injectable()
export class RedisService {
  private readonly redisClient: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redisClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD', 'password'),
      username: this.configService.get<string>('REDIS_USERNAME', 'default'),
      db: this.configService.get<number>('REDIS_DB', 0),
    });
  }

  async addUser(userData: SessionData) {
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
    const pipe = this.redisClient.pipeline();
    pipe.hset(`user:${chatId}`, `${prefix}s`, JSON.stringify(tokens));
    pipe.hmset(`${prefix}:${token.address}:${chatId}`, token);
    pipe.sadd(`${prefix}s:${token.network}`, token.address);
    await pipe.exec();
  }

  async removeToken({ userSession, deleteConditions }: RemoveTokenParams) {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const { chatId } = userSession;

    const { remainingTokens, deletedTokens, deletedTestTokens } = this.filterTokens({
      userSession,
      deleteConditions,
      nodeEnv,
    });

    const pipe = this.redisClient.pipeline();

    this.deleteTokens({ pipe, chatId, tokens: remainingTokens.tokens, deletedTokens, prefix: 'token' });

    if (nodeEnv !== 'production') {
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
    if (nodeEnv !== 'production') {
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

  async removeSubscription({ chatId, subscriptions, subscription }: SubscriptionParams) {
    const curSubscriptions = subscriptions.filter(sub => sub.id !== subscription.id);

    const pipe = this.redisClient.pipeline();

    pipe.hset(`user:${chatId}`, `subscriptions`, JSON.stringify(curSubscriptions));

    pipe.del(`sub:${subscription.address}:${chatId}`);

    await pipe.exec();

    const subExists = await this.hasKeysWithPattern(`sub:${subscription.address}:*`);
    if (!subExists) {
      pipe.srem(`subscriptions:${subscription.network}`, subscription.address);
    }

    await pipe.exec();
  }

  async updateSubscription({ chatId, subscription, subscriptions }: SubscriptionParams) {
    const pipe = this.redisClient.pipeline();

    const curSubscriptions = subscriptions.filter(sub => sub.id !== subscription.id);
    curSubscriptions.push(subscription);

    pipe.hset(`user:${chatId}`, 'subscriptions', JSON.stringify(curSubscriptions));
    pipe.hmset(`sub:${subscription.address}:${chatId}`, subscription);
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
    if (!userData) throw new Error('Пользователь не найден');

    return this.parseUserData<SessionData>(userData);
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
    return await this.redisClient.hget(`user:${chatId}`, 'tempReplication');
  }

  async getWallets(chatId: number): Promise<SessionWallet[] | null> {
    const userData = await this.redisClient.hget(`user:${chatId}`, 'wallets');
    if (!userData) return null;
    return JSON.parse(userData) as SessionWallet[];
  }

  async getTokens(chatId: number): Promise<SessionUserToken[] | null> {
    const userData = await this.redisClient.hget(`user:${chatId}`, 'testTokens');
    if (!userData) return null;
    return JSON.parse(userData) as SessionUserToken[];
  }

  async getTestTokens(chatId: number): Promise<SessionUserToken[] | null> {
    const userData = await this.redisClient.hget(`user:${chatId}`, 'testTokens');
    if (!userData) return null;
    return JSON.parse(userData) as SessionUserToken[];
  }
  async getSubscriptions(chatId: number): Promise<SessionSubscription[] | null> {
    const userData = await this.redisClient.hget(`user:${chatId}`, 'subscriptions');
    if (!userData) return null;
    return JSON.parse(userData) as SessionSubscription[];
  }

  async getAllUsers() {
    const usersIds = await this.redisClient.smembers('users');

    const users: SessionData[] = await Promise.all(
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
  async getTokensSet(network: Network) {
    const tokens = await this.redisClient.smembers(`tokens:${network}`);
    return tokens;
  }
  async getTestTokensSet(network: Network) {
    const tokens = await this.redisClient.smembers(`testTokens:${network}`);
    return tokens;
  }

  async getSubscriptionsSet(network: Network) {
    return await this.redisClient.smembers(`subscriptions:${network}`);
  }

  private filterTokens({ userSession, deleteConditions, nodeEnv }: FilterTokensParams) {
    const { address, network } = deleteConditions;
    const deletedTokens: SessionUserToken[] = [];
    const deletedTestTokens: SessionUserToken[] = [];

    const tokens = userSession.tokens.filter(token => {
      const shouldDelete =
        (!address && !network) || (address && token.address === address) || (network && token.network === network);
      if (shouldDelete) deletedTokens.push(token);
      return !shouldDelete;
    });

    let testTokens = userSession.testTokens;
    if (nodeEnv !== 'production' && testTokens) {
      const idSet = new Set(tokens.map(t => t.id));
      testTokens = testTokens.filter(token => {
        if (!idSet.has(token.id)) {
          deletedTestTokens.push(token);
          return false;
        }
        return true;
      });
    }

    return {
      remainingTokens: { tokens, testTokens },
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

  private parseUserData<T>(data: Record<string, string>): T {
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
