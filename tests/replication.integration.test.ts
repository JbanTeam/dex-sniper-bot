import * as path from 'path';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { Repository } from 'typeorm';

import { User } from '@modules/user/user.entity';
import { UserModule } from '@modules/user/user.module';
import { UserService } from '@modules/user/user.service';
import { Subscription } from '@modules/subscription/subscription.entity';
import { SubscriptionModule } from '@modules/subscription/subscription.module';
import { SubscriptionService } from '@modules/subscription/subscription.service';
import { UserToken } from '@modules/user-token/user-token.entity';
import { UserTokenModule } from '@modules/user-token/user-token.module';
import { UserTokenService } from '@modules/user-token/user-token.service';
import { Replication } from '@modules/replication/replication.entity';
import { ReplicationModule } from '@modules/replication/replication.module';
import { ReplicationService } from '@modules/replication/replication.service';
import { RedisService } from '@modules/redis/redis.service';
import { RedisModule } from '@modules/redis/redis.module';
import { ConstantsModule } from '@modules/constants/constants.module';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { BlockchainModule } from '@modules/blockchain/blockchain.module';
import { ViemProvider } from '@modules/blockchain/viem/viem.provider';
import { AnvilProvider } from '@modules/blockchain/viem/anvil/anvil.provider';
import { ViemHelperProvider } from '@modules/blockchain/viem/viem-helper.provider';
import { BotError } from '@src/errors/BotError';
import { Network, Address, TempReplication, ViemNetwork } from '@src/types/types';
import { ViemClientsType, UnwatchCallback } from '@modules/blockchain/viem/types';
import { PublicClient } from 'viem';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

const mockSubAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;
const mockTokenAddress = '0x7ef95a0fee0dd0fcf22c847284d0aa200b06abc6' as Address; // Example token

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

const mockPairAddresses = {
  pairAddress: '0xPairAddress',
  token0: '0xT0',
  token1: '0xT1',
};

const tokenParams = { name: 'Test Token', symbol: 'TTK', decimals: 18 };

const mockTestToken = {
  id: 1,
  ...tokenParams,
  address: mockTokenAddress,
  network: Network.BSC,
  createdAd: new Date(),
};

const mockAnvilProvider = {
  createClients: jest.fn(),
  initTestAddresses: jest.fn(),
  initTestDex: jest.fn(),
  setTestBalance: jest.fn(),
  createTestToken: jest.fn(),
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

describe('ReplicationService Integration', () => {
  let app: INestApplication;
  let replicationService: ReplicationService;
  let userService: UserService;
  let subscriptionService: SubscriptionService;
  let userTokenService: UserTokenService;
  let userRepository: Repository<User>;
  let subscriptionRepository: Repository<Subscription>;
  let userTokenRepository: Repository<UserToken>;
  let replicationRepository: Repository<Replication>;
  let redisService: RedisService;
  let viemProvider: ViemProvider;
  let constantsProvider: ConstantsProvider;

  const chatId = 987654321;
  const network = Network.BSC;
  let testUser: User;
  let subscription: Subscription;
  let token: UserToken;

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
          useFactory: (constants: ConstantsProvider) => constants.databaseConfig,
        }),
        EventEmitterModule.forRoot(),
        RedisModule,
        UserModule,
        SubscriptionModule,
        UserTokenModule,
        ReplicationModule,
        BlockchainModule,
        ConstantsModule,
      ],
    })
      .overrideProvider(AnvilProvider)
      .useValue(mockAnvilProvider)
      .overrideProvider(ViemHelperProvider)
      .useValue(mockViemHelperProvider)
      .compile();

    replicationService = module.get<ReplicationService>(ReplicationService);
    userService = module.get<UserService>(UserService);
    subscriptionService = module.get<SubscriptionService>(SubscriptionService);
    userTokenService = module.get<UserTokenService>(UserTokenService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    subscriptionRepository = module.get<Repository<Subscription>>(getRepositoryToken(Subscription));
    userTokenRepository = module.get<Repository<UserToken>>(getRepositoryToken(UserToken));
    replicationRepository = module.get<Repository<Replication>>(getRepositoryToken(Replication));
    redisService = module.get<RedisService>(RedisService);
    viemProvider = module.get<ViemProvider>(ViemProvider);
    constantsProvider = module.get<ConstantsProvider>(ConstantsProvider);

    viemProvider['unwatchCallbacks'] = mockUnwatchCallbacks;
    viemProvider['clients'] = mockClients;
    mockViemHelperProvider.initAnvil.mockResolvedValue(undefined);
    mockViemHelperProvider.getClients.mockReturnValue(mockClients);
    mockViemHelperProvider.getPair.mockReturnValue(mockPairAddresses);
    mockViemHelperProvider.initUnwatchCallbacks.mockReturnValue(mockUnwatchCallbacks);
    mockAnvilProvider.setTestBalance.mockResolvedValue(undefined);
    viemProvider.monitorDex = jest.fn().mockResolvedValue(undefined);
    viemProvider.onModuleInit = jest.fn().mockResolvedValue(undefined);
    viemProvider.checkToken = jest.fn().mockResolvedValue({
      ...tokenParams,
      pairAddresses: mockPairAddresses,
    });

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

    await subscriptionService.subscribeToWallet({ chatId, address: mockSubAddress, network });

    const userSession = await redisService.getUser(chatId);

    mockAnvilProvider.createTestToken.mockResolvedValue({
      token: mockTestToken,
      pairAddresses: mockPairAddresses,
    });

    await userTokenService.addToken({
      userSession,
      address: mockTokenAddress,
      network,
    });

    subscription = (await subscriptionRepository.findOne({ where: { address: mockSubAddress } })) as Subscription;
    token = (await userTokenRepository.findOne({ where: { address: mockTokenAddress } })) as UserToken;
  });

  afterAll(async () => {
    await userRepository.query('TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;');
    await redisService['redisClient'].flushall();
    await redisService['redisClient'].quit();
    await app.close();
  });

  describe('getReplications', () => {
    it('should return formatted replications list when replications exist', async () => {
      const tempReplication: TempReplication = {
        action: 'buy',
        limit: 100,
        network,
        subscriptionId: subscription.id,
        tokenId: token.id,
        chatId,
        userId: testUser.id,
      };
      await replicationService.createOrUpdateReplication(tempReplication);

      const result = await replicationService.getReplications(chatId);

      expect(result).toContain('<u>Ваши параметры повторов сделок:</u>');
      const exchangeName = constantsProvider.chains[network].exchange;
      expect(result).toContain(`<u>${exchangeName} (${network}):</u>`);
      expect(result).toContain(`<b>1. 💰 Кошелек:</b> <code>${mockSubAddress}</code>`);
      expect(result).toContain(`<b>${token.symbol}:</b> <code>${mockTokenAddress}</code>`);
      expect(result).toContain('<b>Лимиты:</b> покупка - 100; продажа - 0');
    });

    it('should throw BotError if no replications are found', async () => {
      await expect(replicationService.getReplications(chatId)).rejects.toThrow(
        new BotError('You have no replicatons', 'Вы не устанавливали повтор сделок', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('createOrUpdateReplication', () => {
    it('should create a new replication', async () => {
      const tempReplication: TempReplication = {
        action: 'buy',
        limit: 150,
        network,
        subscriptionId: subscription.id,
        tokenId: token.id,
        chatId,
        userId: testUser.id,
      };

      const resultMessage = await replicationService.createOrUpdateReplication(tempReplication);

      const replicationsInDb = await replicationRepository.find({
        where: { user: { id: testUser.id } },
        relations: ['token', 'subscription'],
      });
      expect(replicationsInDb).toHaveLength(1);
      expect(replicationsInDb[0].buy).toBe(150);
      expect(replicationsInDb[0].sell).toBe(0);
      expect(replicationsInDb[0].network).toBe(network);
      expect(replicationsInDb[0].token.id).toBe(token.id);
      expect(replicationsInDb[0].subscription.id).toBe(subscription.id);

      const userSession = await redisService.getUser(chatId);
      expect(userSession.replications).toHaveLength(1);
      const sessionRep = userSession.replications[0];
      expect(sessionRep.buy).toBe(150);
      expect(sessionRep.sell).toBe(0);
      expect(sessionRep.tokenAddress).toBe(mockTokenAddress);
      expect(sessionRep.subscriptionAddress).toBe(mockSubAddress);

      expect(resultMessage).toContain(`<u>Кошелек:</u> <b>${network}</b> <code>${mockSubAddress}</code>`);
      expect(resultMessage).toContain(`<u>Токен:</u> <b>${token.name} (${token.symbol})</b>`);
      expect(resultMessage).toContain('<u>Лимит на покупку:</u> <b>150</b>');
      expect(resultMessage).toContain('<u>Лимит на продажу:</u> <b>0</b>');
    });

    it('should update an existing replication (buy limit)', async () => {
      const initialTempReplication: TempReplication = {
        action: 'buy',
        limit: 100,
        network,
        subscriptionId: subscription.id,
        tokenId: token.id,
        chatId,
        userId: testUser.id,
      };
      await replicationService.createOrUpdateReplication(initialTempReplication);

      const updateTempReplication: TempReplication = {
        action: 'buy',
        limit: 250,
        network,
        subscriptionId: subscription.id,
        tokenId: token.id,
        chatId,
        userId: testUser.id,
      };
      const resultMessage = await replicationService.createOrUpdateReplication(updateTempReplication);

      const replicationsInDb = await replicationRepository.find({ where: { user: { id: testUser.id } } });
      expect(replicationsInDb).toHaveLength(1);
      expect(replicationsInDb[0].buy).toBe(250);
      expect(replicationsInDb[0].sell).toBe(0);

      const userSession = await redisService.getUser(chatId);
      expect(userSession.replications).toHaveLength(1);
      expect(userSession.replications[0].buy).toBe(250);
      expect(userSession.replications[0].sell).toBe(0);

      expect(resultMessage).toContain('<u>Лимит на покупку:</u> <b>250</b>');
      expect(resultMessage).toContain('<u>Лимит на продажу:</u> <b>0</b>');
    });

    it('should update an existing replication (sell limit)', async () => {
      const initialTempReplication: TempReplication = {
        action: 'buy',
        limit: 100,
        network,
        subscriptionId: subscription.id,
        tokenId: token.id,
        chatId,
        userId: testUser.id,
      };
      await replicationService.createOrUpdateReplication(initialTempReplication);

      const updateTempReplication: TempReplication = {
        action: 'sell',
        limit: 300,
        network,
        subscriptionId: subscription.id,
        tokenId: token.id,
        chatId,
        userId: testUser.id,
      };
      const resultMessage = await replicationService.createOrUpdateReplication(updateTempReplication);

      const replicationsInDb = await replicationRepository.find({ where: { user: { id: testUser.id } } });
      expect(replicationsInDb).toHaveLength(1);
      expect(replicationsInDb[0].buy).toBe(100);
      expect(replicationsInDb[0].sell).toBe(300);

      const userSession = await redisService.getUser(chatId);
      expect(userSession.replications).toHaveLength(1);
      expect(userSession.replications[0].buy).toBe(100);
      expect(userSession.replications[0].sell).toBe(300);

      expect(resultMessage).toContain('<u>Лимит на покупку:</u> <b>100</b>');
      expect(resultMessage).toContain('<u>Лимит на продажу:</u> <b>300</b>');
    });

    it('should throw BotError for invalid tempReplication data (missing chatId)', async () => {
      const tempReplication: any = {
        action: 'buy',
        limit: 100,
        network,
        subscriptionId: subscription.id,
        tokenId: token.id,
      };
      await expect(replicationService.createOrUpdateReplication(tempReplication)).rejects.toThrow(
        new BotError('Invalid data in tempReplication', 'Не удалось установить повтор сделок', HttpStatus.BAD_REQUEST),
      );
    });

    it('should create a new replication with real tokenAddress (NODE_ENV = production)', async () => {
      Object.defineProperty(constantsProvider, 'notProd', { value: false, configurable: true });

      const mockTestTokenAddress = '0xTestTokenAddress' as Address;
      const userSessionBefore = await redisService.getUser(chatId);
      userSessionBefore.testTokens = [
        {
          id: token.id,
          address: mockTestTokenAddress,
          network: token.network,
          name: 'Test Token (Test Version)',
          symbol: 'TTK-T',
          decimals: token.decimals,
        },
      ];
      await redisService.addUser(userSessionBefore);

      const tempReplication: TempReplication = {
        action: 'buy',
        limit: 175,
        network,
        subscriptionId: subscription.id,
        tokenId: token.id,
        chatId,
        userId: testUser.id,
      };

      const resultMessage = await replicationService.createOrUpdateReplication(tempReplication);

      const replicationsInDb = await replicationRepository.find({ where: { user: { id: testUser.id } } });
      expect(replicationsInDb).toHaveLength(1);
      expect(replicationsInDb[0].buy).toBe(175);

      const userSessionAfter = await redisService.getUser(chatId);
      expect(userSessionAfter.replications).toHaveLength(1);
      const sessionRep = userSessionAfter.replications[0];
      expect(sessionRep.buy).toBe(175);
      // tokenAddress in replication must be mockTokenAddress because NODE_ENV = production
      expect(sessionRep.tokenAddress).toBe(mockTokenAddress);
      expect(sessionRep.subscriptionAddress).toBe(mockSubAddress);

      expect(resultMessage).toContain(`<u>Токен:</u> <b>${token.name} (${token.symbol})</b>`);
      expect(resultMessage).toContain('<u>Лимит на покупку:</u> <b>175</b>');

      Object.defineProperty(constantsProvider, 'notProd', { value: true, configurable: true });
    });
  });
});
