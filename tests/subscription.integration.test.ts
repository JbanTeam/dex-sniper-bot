import * as path from 'path';
import { PublicClient } from 'viem';
import { Repository } from 'typeorm';
import { ConfigModule } from '@nestjs/config';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';

import { User } from '@modules/user/user.entity';
import { UserModule } from '@modules/user/user.module';
import { UserService } from '@modules/user/user.service';
import { Subscription } from '@modules/subscription/subscription.entity';
import { SubscriptionModule } from '@modules/subscription/subscription.module';
import { SubscriptionService } from '@modules/subscription/subscription.service';
import { RedisService } from '@modules/redis/redis.service';
import { ConstantsModule } from '@modules/constants/constants.module';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { BotError } from '@libs/core/errors';
import { BlockchainModule } from '@modules/blockchain/blockchain.module';
import { ViemProvider } from '@modules/blockchain/viem/viem.provider';
import { AnvilProvider } from '@modules/blockchain/viem/anvil/anvil.provider';
import { ViemHelperProvider } from '@modules/blockchain/viem/viem-helper.provider';
import { RedisModule } from '@modules/redis/redis.module';
import { UnwatchCallback, ViemClientsType } from '@modules/blockchain/viem/types';
import { Network, Address, ViemNetwork } from '@src/types/types';

const mockSubAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

const mockPublicClient = {
  readContract: jest.fn(),
  simulateContract: jest.fn(),
  getBalance: jest.fn(),
  waitForTransactionReceipt: jest.fn(),
} as unknown as PublicClient;

const mockClients = Object.keys(ViemNetwork).reduce(
  (clients, keyNetwork) => {
    clients.public[keyNetwork] = mockPublicClient;
    clients.publicWebsocket[keyNetwork] = mockPublicClient;

    return clients;
  },
  { public: {}, publicWebsocket: {} } as ViemClientsType,
);

const mockUnwatchCallbacks: UnwatchCallback = {
  BSC: () => {},
  POLYGON: () => {},
};

const mockAnvilProvider = {
  createClients: jest.fn(),
  initTestAddresses: jest.fn(),
  initTestDex: jest.fn(),
  setTestBalance: jest.fn(),
};

const mockViemHelperProvider = {
  getClients: jest.fn(),
  initUnwatchCallbacks: jest.fn(),
  getPair: jest.fn(),
  balanceOf: jest.fn(),
  transfer: jest.fn(),
  transferNative: jest.fn(),
  initAnvil: jest.fn(),
  formatBalanceResponse: jest.fn(),
};

describe('SubscriptionService Integration', () => {
  let app: INestApplication;
  let subscriptionService: SubscriptionService;
  let userService: UserService;
  let userRepository: Repository<User>;
  let subscriptionRepository: Repository<Subscription>;
  let redisService: RedisService;
  let viemProvider: ViemProvider;

  const chatId = 123456789;
  const network = Network.BSC;
  let testUser: User;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: [path.resolve(__dirname, '..', '.env.test')],
          isGlobal: true,
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConstantsModule],
          inject: [ConstantsProvider],
          useFactory: (constants: ConstantsProvider) => {
            return constants.databaseConfig;
          },
        }),
        RedisModule,
        UserModule,
        BlockchainModule,
        SubscriptionModule,
      ],
    })
      .overrideProvider(AnvilProvider)
      .useValue(mockAnvilProvider)
      .overrideProvider(ViemHelperProvider)
      .useValue(mockViemHelperProvider)
      .compile();

    subscriptionService = module.get<SubscriptionService>(SubscriptionService);
    userService = module.get<UserService>(UserService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    subscriptionRepository = module.get<Repository<Subscription>>(getRepositoryToken(Subscription));
    redisService = module.get<RedisService>(RedisService);
    viemProvider = module.get<ViemProvider>(ViemProvider);

    viemProvider['unwatchCallbacks'] = mockUnwatchCallbacks;
    viemProvider['clients'] = mockClients;
    mockViemHelperProvider.initAnvil.mockResolvedValue(undefined);
    mockViemHelperProvider.getClients.mockReturnValue(mockClients);
    mockViemHelperProvider.initUnwatchCallbacks.mockReturnValue(mockUnwatchCallbacks);
    mockAnvilProvider.setTestBalance.mockResolvedValue(undefined);
    viemProvider.monitorDex = jest.fn().mockResolvedValue(undefined);
    viemProvider.onModuleInit = jest.fn().mockResolvedValue(undefined);

    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await userRepository.query('TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;');
    await redisService['redisClient'].flushall();

    const { user } = await userService.getOrCreateUser(chatId);
    testUser = user!;

    await redisService.addUser({
      chatId,
      userId: user!.id,
      action: 'get',
      wallets: [...user!.wallets],
      tokens: [...user!.tokens],
      subscriptions: [...user!.subscriptions],
      replications: [],
    });
  });

  afterAll(async () => {
    await userRepository.query('TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;');
    await redisService['redisClient'].flushall();
    await redisService['redisClient'].quit();
    await app.close();
  });

  describe('subscribeToWallet', () => {
    it('should subscribe a user to a wallet', async () => {
      const spyAddSub = jest.spyOn(redisService, 'addSubscription');
      await subscriptionService.subscribeToWallet({ chatId, address: mockSubAddress, network });

      const subscriptions = await subscriptionRepository.find({ where: { user: { id: testUser!.id } } });
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].address).toBe(mockSubAddress);
      expect(subscriptions[0].network).toBe(network);
      expect(spyAddSub).toHaveBeenCalledTimes(1);
    });

    it('should throw BotError if already subscribed', async () => {
      await subscriptionService.subscribeToWallet({ chatId, address: mockSubAddress, network });

      await expect(subscriptionService.subscribeToWallet({ chatId, address: mockSubAddress, network })).rejects.toThrow(
        new BotError('You are already subscribed', 'Вы уже подписаны на этот кошелек', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw BotError if subscribing to own wallet', async () => {
      const ownWalletAddress = testUser!.wallets.find(w => w.network === network)?.address;

      await expect(
        subscriptionService.subscribeToWallet({ chatId, address: ownWalletAddress!, network }),
      ).rejects.toThrow(
        new BotError('Subscribing on own wallet', 'Вы не можете подписаться на свой кошелек', HttpStatus.BAD_REQUEST),
      );
    });
  });

  describe('unsubscribeFromWallet', () => {
    it('should unsubscribe a user from a wallet', async () => {
      const spyRemoveSub = jest.spyOn(redisService, 'removeSubscription');

      await subscriptionService.subscribeToWallet({ chatId, address: mockSubAddress, network });

      await subscriptionService.unsubscribeFromWallet({ chatId, walletAddress: mockSubAddress });

      const subscriptions = await subscriptionRepository.find({ where: { user: { id: testUser.id } } });
      expect(subscriptions).toHaveLength(0);
      expect(spyRemoveSub).toHaveBeenCalledTimes(1);
    });

    it('should throw BotError if user has no subscriptions', async () => {
      await expect(
        subscriptionService.unsubscribeFromWallet({ chatId, walletAddress: mockSubAddress }),
      ).rejects.toThrow(
        new BotError('You have no subscriptions', 'Вы не подписаны ни на один кошелек', HttpStatus.NOT_FOUND),
      );
    });

    it('should throw BotError if not subscribed to the specific wallet', async () => {
      await subscriptionService.subscribeToWallet({ chatId, address: mockSubAddress, network });

      await expect(
        subscriptionService.unsubscribeFromWallet({ chatId, walletAddress: (mockSubAddress + 'r') as Address }),
      ).rejects.toThrow(
        new BotError(
          'You are not subscribed on this wallet',
          'Вы не подписаны на этот кошелек',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  describe('getSubscriptions', () => {
    it('should return formatted subscriptions list', async () => {
      await subscriptionService.subscribeToWallet({ chatId, address: mockSubAddress, network });

      const result = await subscriptionService.getSubscriptions(chatId);

      expect(result).toContain('<b>Ваши подписки:</b>');
      expect(result).toContain(`<u><b>PancakeSwap (${Network.BSC}):</b></u>`);
      expect(result).toContain(`<code>${mockSubAddress}</code>`);
    });

    it('should throw BotError if no subscriptions found in Redis', async () => {
      await expect(subscriptionService.getSubscriptions(chatId)).rejects.toThrow(
        new BotError('You have no subscriptions', 'Вы не подписаны ни на один кошелек', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('findSubscriptionsByAddress', () => {
    it('should return subscriptions matching the address', async () => {
      await subscriptionService.subscribeToWallet({ chatId, address: mockSubAddress, network });

      const result = await subscriptionService.findSubscriptionsByAddress(mockSubAddress);
      expect(result).toHaveLength(1);
      result.forEach(sub => {
        expect(sub.address).toBe(mockSubAddress);
        expect(sub.user).toBeDefined();
        expect(sub.user.chatId).toBeDefined();
        expect(sub.user.wallets).toBeDefined();
      });
    });

    it('should return an empty array if no subscriptions match', async () => {
      const result = await subscriptionService.findSubscriptionsByAddress(mockSubAddress);
      expect(result).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('should return a subscription if found by ID', async () => {
      await subscriptionService.subscribeToWallet({ chatId, address: mockSubAddress, network });

      const result = await subscriptionService.findById(1);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.address).toBe(mockSubAddress);
    });

    it('should return null if subscription not found by ID', async () => {
      const result = await subscriptionService.findById(99999); // Non-existent ID
      expect(result).toBeNull();
    });
  });
});
