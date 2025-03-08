import Redis from 'ioredis';
import { StorageAdapter } from 'grammy';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SessionData } from '@src/types/types';

@Injectable()
export class RedisService {
  private readonly redisClient: Redis;

  constructor(private readonly configService: ConfigService) {
    this.configService = configService;
    this.redisClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD', 'password'),
      username: this.configService.get<string>('REDIS_USERNAME', 'default'),
      db: this.configService.get<number>('REDIS_DB', 0),
    });
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await this.redisClient.set(key, value);
    } catch (error) {
      console.error('Error setting value in Redis:', error);
      throw error;
    }
  }

  async setSessionData(key: string, sessionData: SessionData): Promise<void> {
    try {
      await this.redisClient.set(key, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Error setting session data in Redis:', error);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redisClient.get(key);
    } catch (error) {
      console.error('Error getting value from Redis:', error);
      throw error;
    }
  }

  async getSessionData(key: string): Promise<SessionData | undefined> {
    const data: string | null = await this.redisClient.get(key);
    return this.parseSessionData(data);
  }

  async del(key: string): Promise<void> {
    try {
      await this.redisClient.del(key);
    } catch (error) {
      console.error('Error deleting value from Redis:', error);
      throw error;
    }
  }

  private parseSessionData(data: string | null): SessionData | undefined {
    if (!data) return undefined;
    try {
      const sessionData = JSON.parse(data) as object;
      if (
        !('state' in sessionData) &&
        !('tempToken' in sessionData) &&
        !('tempNetwork' in sessionData) &&
        !('userId' in sessionData) &&
        !('chatId' in sessionData) &&
        !('telegramUserId' in sessionData)
      ) {
        throw new Error('Invalid SessionData');
      }
      return sessionData as SessionData;
    } catch (error) {
      console.error('Error parsing SessionData:', error);
      return undefined;
    }
  }

  getStorage(): StorageAdapter<SessionData> {
    return {
      read: async (key: string): Promise<SessionData | undefined> => {
        const data: string | null = await this.redisClient.get(key);
        return this.parseSessionData(data);
      },
      write: async (key: string, data: SessionData): Promise<void> => {
        await this.redisClient.set(key, JSON.stringify(data));
        await this.redisClient.expire(key, 3600 * 24 * 30);
      },
      delete: async (key: string): Promise<void> => {
        await this.redisClient.del(key);
      },
    };
  }
}
