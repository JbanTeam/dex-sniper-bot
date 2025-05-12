import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';

import { SubscriptionService } from '../subscription.service';
import { Subscription } from '../subscription.entity';
import { User } from '@modules/user/user.entity';
import { RedisService } from '@modules/redis/redis.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { BotError } from '@src/errors/BotError';
import { ChainsType } from '@src/types/types';
import { SubscribeToWalletParams, UnsubscribeFromWalletParams } from '../types';

const mockSubscription = {
  id: 1,
  address: '0xSubAddress',
  network: 'BSC',
  user: { id: 1 } as User,
  replications: [],
} as Subscription;

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;
  let mockSubscriptionRepository: Partial<Repository<Subscription>>;
  let mockRedisService: Partial<RedisService>;
  let mockConstantsProvider: Partial<ConstantsProvider>;

  beforeEach(async () => {
    mockSubscriptionRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    mockRedisService = {
      getUser: jest.fn(),
      addSubscription: jest.fn(),
      removeSubscription: jest.fn(),
      getSubscriptions: jest.fn(),
    };

    mockConstantsProvider = {
      chains: {
        BSC: { exchange: 'Binance' },
      } as ChainsType,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: mockSubscriptionRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: ConstantsProvider,
          useValue: mockConstantsProvider,
        },
      ],
    }).compile();

    subscriptionService = module.get<SubscriptionService>(SubscriptionService);
  });

  describe('subscribeToWallet', () => {
    it('should subscribe to wallet with provided params', async () => {
      const params: SubscribeToWalletParams = {
        chatId: 123,
        address: '0xSubAddress',
        network: 'BSC',
      };

      const mockUserSession = {
        userId: 1,
        subscriptions: [],
        wallets: [],
      };

      mockRedisService.getUser = jest.fn().mockResolvedValue(mockUserSession);
      mockSubscriptionRepository.create = jest.fn().mockReturnValue(mockSubscription);
      mockSubscriptionRepository.save = jest.fn().mockResolvedValue(mockSubscription);

      await subscriptionService.subscribeToWallet(params);

      expect(mockSubscriptionRepository.create).toHaveBeenCalledWith({
        user: { id: mockUserSession.userId },
        address: params.address,
        network: params.network,
      });
      expect(mockSubscriptionRepository.save).toHaveBeenCalledWith(mockSubscription);
      expect(mockRedisService.addSubscription).toHaveBeenCalled();
    });

    it('should throw error if already subscribed', async () => {
      const params: SubscribeToWalletParams = {
        chatId: 123,
        address: '0xSubAddress',
        network: 'BSC',
      };

      const mockUserSession = {
        subscriptions: [{ address: '0xSubAddress' }],
        wallets: [],
      };

      mockRedisService.getUser = jest.fn().mockResolvedValue(mockUserSession);

      await expect(subscriptionService.subscribeToWallet(params)).rejects.toThrow(
        new BotError('You are already subscribed', 'Вы уже подписаны на этот кошелек', 400),
      );
    });
  });

  describe('unsubscribeFromWallet', () => {
    it('should unsubscribe from wallet', async () => {
      const params: UnsubscribeFromWalletParams = {
        chatId: 123,
        walletAddress: '0xSubAddress',
      };

      const mockUserSession = {
        subscriptions: [mockSubscription],
      };

      mockRedisService.getUser = jest.fn().mockResolvedValue(mockUserSession);
      mockSubscriptionRepository.findOne = jest.fn().mockResolvedValue(mockSubscription);
      mockSubscriptionRepository.delete = jest.fn().mockResolvedValue({ affected: 1 });

      await subscriptionService.unsubscribeFromWallet(params);

      expect(mockSubscriptionRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockSubscription.id },
      });
      expect(mockSubscriptionRepository.delete).toHaveBeenCalledWith({ id: mockSubscription.id });
      expect(mockRedisService.removeSubscription).toHaveBeenCalled();
    });

    it('should throw error if not subscribed', async () => {
      const params: UnsubscribeFromWalletParams = {
        chatId: 123,
        walletAddress: '0xSubAddress',
      };

      const mockUserSession = {
        subscriptions: [],
      };

      mockRedisService.getUser = jest.fn().mockResolvedValue(mockUserSession);

      await expect(subscriptionService.unsubscribeFromWallet(params)).rejects.toThrow(
        new BotError('You have no subscriptions', 'Вы не подписаны ни на один кошелек', 404),
      );
    });
  });

  describe('getSubscriptions', () => {
    it('should return formatted subscriptions list', async () => {
      const chatId = 123;
      const mockSubscriptions = [mockSubscription];

      mockRedisService.getSubscriptions = jest.fn().mockResolvedValue(mockSubscriptions);

      const result = await subscriptionService.getSubscriptions(chatId);

      expect(result).toContain('<b>Ваши подписки:</b>');
      expect(result).toContain('<u><b>Binance (BSC):</b></u>');
      expect(result).toContain('<code>0xSubAddress</code>');
    });

    it('should throw error when no subscriptions found', async () => {
      const chatId = 123;

      mockRedisService.getSubscriptions = jest.fn().mockResolvedValue([]);

      await expect(subscriptionService.getSubscriptions(chatId)).rejects.toThrow(
        new BotError('You have no subscriptions', 'Вы не подписаны ни на один кошелек', 404),
      );
    });
  });

  describe('findSubscriptionsByAddress', () => {
    it('should return subscriptions by address', async () => {
      const address = '0xSubAddress';

      mockSubscriptionRepository.find = jest.fn().mockResolvedValue([mockSubscription]);

      const result = await subscriptionService.findSubscriptionsByAddress(address);

      expect(mockSubscriptionRepository.find).toHaveBeenCalledWith({
        where: { address },
        relations: ['user', 'user.wallets'],
        select: {
          id: true,
          address: true,
          network: true,
          user: {
            chatId: true,
            wallets: {
              address: true,
              network: true,
              encryptedPrivateKey: true,
            },
          },
        },
      });
      expect(result).toEqual([mockSubscription]);
    });
  });

  describe('findById', () => {
    it('should return subscription by id', async () => {
      const id = 1;

      mockSubscriptionRepository.findOne = jest.fn().mockResolvedValue(mockSubscription);

      const result = await subscriptionService.findById(id);

      expect(mockSubscriptionRepository.findOne).toHaveBeenCalledWith({
        where: { id },
      });
      expect(result).toBe(mockSubscription);
    });

    it('should return null when subscription not found', async () => {
      const id = 1;

      mockSubscriptionRepository.findOne = jest.fn().mockResolvedValue(null);

      const result = await subscriptionService.findById(id);

      expect(result).toBeNull();
    });
  });
});
