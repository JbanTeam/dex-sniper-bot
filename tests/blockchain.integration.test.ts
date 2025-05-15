import * as path from 'path';
import { Repository } from 'typeorm';
import { ConfigModule } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { createPublicClient, http, webSocket } from 'viem';

import { isNetwork } from '@src/types/typeGuards';
import { BotError } from '@src/errors/BotError';
import { User } from '@modules/user/user.entity';
import { UserModule } from '@modules/user/user.module';
import { UserService } from '@modules/user/user.service';
import { Wallet } from '@modules/wallet/wallet.entity';
import { WalletModule } from '@modules/wallet/wallet.module';
import { WalletService } from '@modules/wallet/wallet.service';
import { RedisService } from '@modules/redis/redis.service';
import { RedisModule } from '@modules/redis/redis.module';
import { ConstantsModule } from '@modules/constants/constants.module';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { BlockchainModule } from '@modules/blockchain/blockchain.module';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { ViemProvider } from '@modules/blockchain/viem/viem.provider';
import { AnvilProvider } from '@modules/blockchain/viem/anvil/anvil.provider';
import { ViemHelperProvider } from '@modules/blockchain/viem/viem-helper.provider';
import { Network, Address, ViemNetwork } from '@src/types/types';
import { ViemClientsType, UnwatchCallback } from '@modules/blockchain/viem/types';

const mockTokenAddress = '0xc748673057861a797275CD8A068AbB95A902e8de' as Address;
const mockRecipientAddress = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8' as Address;

const mockUnwatchCallbacks: UnwatchCallback = {
  BSC: () => {},
  POLYGON: () => {},
};

const mockPairAddresses = {
  pairAddress: '0xc736ca3d9b1e90af4230bd8f9626528b3d4e0ee0',
  token0: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
  token1: '0xc748673057861a797275cd8a068abb95a902e8de',
};

const tokenParams = { name: 'Baby Doge Coin', symbol: 'BabyDoge', decimals: 9 };

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
  fakeSwapTo: jest.fn(),
  fakeSwapFrom: jest.fn(),
};

describe('BlockchainService Integration', () => {
  let app: INestApplication;
  let blockchainService: BlockchainService;
  let userService: UserService;
  let walletService: WalletService;
  let userRepository: Repository<User>;
  let walletRepository: Repository<Wallet>;
  let redisService: RedisService;
  let viemProvider: ViemProvider;
  let viemHelper: ViemHelperProvider;
  let constantsProvider: ConstantsProvider;

  const chatId = 123456789;
  const network = Network.BSC;
  let mockClients: ViemClientsType;

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
        WalletModule,
        BlockchainModule,
        ConstantsModule,
      ],
    })
      .overrideProvider(AnvilProvider)
      .useValue(mockAnvilProvider)
      // .overrideProvider(ViemHelperProvider)
      // .useValue(mockViemHelperProvider)
      .compile();

    blockchainService = module.get<BlockchainService>(BlockchainService);
    userService = module.get<UserService>(UserService);
    walletService = module.get<WalletService>(WalletService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    walletRepository = module.get<Repository<Wallet>>(getRepositoryToken(Wallet));
    redisService = module.get<RedisService>(RedisService);
    viemProvider = module.get<ViemProvider>(ViemProvider);
    viemHelper = module.get<ViemHelperProvider>(ViemHelperProvider);
    constantsProvider = module.get<ConstantsProvider>(ConstantsProvider);

    viemHelper.initAnvil = jest.fn().mockResolvedValue(undefined);
    viemHelper.getClients = jest.fn().mockReturnValue(mockClients);
    // mockViemHelperProvider.initAnvil.mockResolvedValue(undefined);
    // mockViemHelperProvider.initUnwatchCallbacks.mockReturnValue(mockUnwatchCallbacks);
    mockAnvilProvider.setTestBalance.mockResolvedValue(undefined);
    mockAnvilProvider.createTestToken.mockResolvedValue({
      token: mockTestToken,
      pairAddresses: mockPairAddresses,
    });
    viemProvider.monitorDex = jest.fn().mockResolvedValue(undefined);
    viemProvider.onModuleInit = jest.fn().mockResolvedValue(undefined);
    // viemProvider.checkToken = jest.fn().mockResolvedValue({
    //   ...tokenParams,
    //   pairAddresses: mockPairAddresses,
    // });

    mockClients = Object.keys(ViemNetwork).reduce(
      (clients, keyNetwork) => {
        isNetwork(keyNetwork);
        const { chain, rpcUrl, rpcWsUrl } = constantsProvider.chains[keyNetwork];
        clients.public[keyNetwork] = createPublicClient({
          chain,
          transport: http(rpcUrl),
        });

        clients.publicWebsocket[keyNetwork] = createPublicClient({
          chain,
          transport: webSocket(rpcWsUrl),
        });

        return clients;
      },
      { public: {}, publicWebsocket: {} } as ViemClientsType,
    );

    viemProvider['unwatchCallbacks'] = mockUnwatchCallbacks;
    viemProvider['clients'] = mockClients;
    viemHelper['clients'] = mockClients;

    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await userRepository.query('TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;');
    await redisService['redisClient'].flushall();

    const { user } = await userService.getOrCreateUser(chatId);

    await redisService.addUser({
      chatId,
      userId: user!.id,
      action: 'get',
      wallets: [...user!.wallets],
      tokens: [],
      subscriptions: [],
      replications: [],
    });
  });

  afterAll(async () => {
    await userRepository.query('TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;');
    await redisService['redisClient'].flushall();
    await redisService['redisClient'].quit();
    await app.close();
  });

  describe('createWallet', () => {
    it('should create wallet successfully', async () => {
      const spyCreateWallet = jest.spyOn(walletService, 'createWallet');
      const userSession = await redisService.getUser(chatId);

      const wallet = await blockchainService.createWallet({
        userId: userSession.userId,
        network,
      });

      expect(wallet).toBeDefined();
      expect(wallet.network).toBe(network);
      expect(wallet.address).toBeDefined();
      expect(wallet.encryptedPrivateKey).toBeDefined();

      expect(spyCreateWallet).toHaveBeenCalled();

      const savedWallet = await walletRepository.findOne({ where: { id: wallet.id } });
      expect(savedWallet).toBeDefined();
      expect(savedWallet?.network).toBe(network);
    });
  });

  describe('checkToken', () => {
    it('should check token successfully', async () => {
      const spyGetPair = jest.spyOn(viemHelper, 'getPair');

      const result = await blockchainService.checkToken({
        address: mockTokenAddress,
        network,
      });

      expect(spyGetPair).toHaveBeenCalled();
      expect(result.name).toBe(tokenParams.name);
      expect(result.symbol).toBe(tokenParams.symbol);
      expect(result.decimals).toBe(tokenParams.decimals);
      expect(result.pairAddresses.pairAddress.toLowerCase()).toEqual(mockPairAddresses.pairAddress.toLowerCase());
    });

    it('should throw error when token does not exist', async () => {
      await expect(
        blockchainService.checkToken({
          address: '0xInvalidAddress' as Address,
          network,
        }),
      ).rejects.toThrow(BotError);
    });
  });

  describe('getBalance', () => {
    it('should get balance successfully', async () => {
      const spyGetBalance = jest.spyOn(viemProvider, 'getBalance');
      // viemProvider.getBalance = jest.fn().mockResolvedValue(mockBalance);

      const userSession = await redisService.getUser(chatId);
      const wallet = await blockchainService.createWallet({
        userId: userSession.userId,
        network,
      });

      const result = await blockchainService.getBalance({
        chatId,
        address: wallet.address,
        network,
      });

      expect(result).toContain('<b>BNB:</b> 0');
      expect(spyGetBalance).toHaveBeenCalledWith({
        chatId,
        address: wallet.address,
        network,
      });
    });
  });

  describe('createTestToken', () => {
    it('should create test token successfully', async () => {
      const userSession = await redisService.getUser(chatId);
      const wallet = await blockchainService.createWallet({
        userId: userSession.userId,
        network,
      });

      const result = await blockchainService.createTestToken({
        wallet,
        token: mockTestToken,
      });

      expect(result.token).toEqual(mockTestToken);
      expect(result.pairAddresses).toEqual(mockPairAddresses);
      expect(mockAnvilProvider.createTestToken).toHaveBeenCalledWith({
        walletAddress: wallet.address,
        token: mockTestToken,
      });
    });
  });

  describe('sendTokens', () => {
    it('should send tokens successfully', async () => {
      const spySendTokens = jest.spyOn(viemProvider, 'sendTokens');
      spySendTokens.mockResolvedValue(undefined);

      const userSession = await redisService.getUser(chatId);
      const wallet = await blockchainService.createWallet({
        userId: userSession.userId,
        network,
      });

      await blockchainService.sendTokens({
        userSession,
        wallet,
        token: mockTestToken,
        amount: '10',
        recipientAddress: mockRecipientAddress,
      });

      expect(spySendTokens).toHaveBeenCalledWith({
        userSession,
        wallet,
        token: mockTestToken,
        amount: '10',
        recipientAddress: mockRecipientAddress,
      });
    });
  });

  describe('sendNative', () => {
    it('should send native currency successfully', async () => {
      const spySendNative = jest.spyOn(viemProvider, 'sendNative');
      spySendNative.mockResolvedValue(undefined);

      const userSession = await redisService.getUser(chatId);
      const wallet = await blockchainService.createWallet({
        userId: userSession.userId,
        network,
      });

      await blockchainService.sendNative({
        userSession,
        wallet,
        amount: '0.1',
        recipientAddress: mockRecipientAddress,
      });

      expect(spySendNative).toHaveBeenCalledWith({
        userSession,
        wallet,
        amount: '0.1',
        recipientAddress: mockRecipientAddress,
      });
    });
  });

  describe('fakeSwapTo and fakeSwapFrom', () => {
    it('should perform fake swap to token', async () => {
      await blockchainService.fakeSwapTo(mockTestToken);
      expect(mockAnvilProvider.fakeSwapTo).toHaveBeenCalledWith(mockTestToken);
    });

    it('should perform fake swap from token', async () => {
      await blockchainService.fakeSwapFrom(mockTestToken);
      expect(mockAnvilProvider.fakeSwapFrom).toHaveBeenCalledWith(mockTestToken);
    });
  });
});
