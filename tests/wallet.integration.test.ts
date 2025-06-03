import * as path from 'path';
import { PublicClient } from 'viem';
import { Repository } from 'typeorm';
import { ConfigModule } from '@nestjs/config';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';

import { BotError } from '@src/errors/BotError';
import { User } from '@modules/user/user.entity';
import { UserModule } from '@modules/user/user.module';
import { UserService } from '@modules/user/user.service';
import { Wallet } from '@modules/wallet/wallet.entity';
import { WalletModule } from '@modules/wallet/wallet.module';
import { WalletService } from '@modules/wallet/wallet.service';
import { RedisService } from '@modules/redis/redis.service';
import { ConstantsModule } from '@modules/constants/constants.module';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { RedisModule } from '@modules/redis/redis.module';
import { ViemProvider } from '@modules/blockchain/viem/viem.provider';
import { AnvilProvider } from '@modules/blockchain/viem/anvil/anvil.provider';
import { BlockchainModule } from '@modules/blockchain/blockchain.module';
import { ViemHelperProvider } from '@modules/blockchain/viem/viem-helper.provider';
import { UnwatchCallback, ViemClientsType } from '@modules/blockchain/viem/types';
import { Network, Address, ViemNetwork } from '@src/types/types';

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

describe('WalletService Integration', () => {
  let app: INestApplication;
  let walletService: WalletService;
  let userService: UserService;
  let userRepository: Repository<User>;
  let walletRepository: Repository<Wallet>;
  let redisService: RedisService;
  let viemProvider: ViemProvider;

  const chatId = 123456789;
  const network = Network.BSC;
  let testUser: User;
  const mockWalletAddress = '0x1234567890123456789012345678901234567890' as Address;
  const mockEncryptedPrivateKey = 'mockEncryptedPrivateKey';

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
        WalletModule,
        BlockchainModule,
      ],
    })
      .overrideProvider(AnvilProvider)
      .useValue(mockAnvilProvider)
      .overrideProvider(ViemHelperProvider)
      .useValue(mockViemHelperProvider)
      .compile();

    walletService = module.get<WalletService>(WalletService);
    userService = module.get<UserService>(UserService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    walletRepository = module.get<Repository<Wallet>>(getRepositoryToken(Wallet));
    redisService = module.get<RedisService>(RedisService);
    viemProvider = module.get<ViemProvider>(ViemProvider);

    viemProvider['unwatchCallbacks'] = mockUnwatchCallbacks;
    viemProvider['clients'] = mockClients;
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

  describe('createWallet', () => {
    it('should create a new wallet and save it to the database', async () => {
      const createWalletParams = {
        network,
        encryptedPrivateKey: mockEncryptedPrivateKey,
        address: mockWalletAddress,
        userId: testUser.id,
      };

      const createdWallet = await walletService.createWallet(createWalletParams);

      expect(createdWallet).toBeDefined();
      expect(createdWallet.id).toBeDefined();
      expect(createdWallet.network).toBe(network);
      expect(createdWallet.address).toBe(mockWalletAddress);
      expect(createdWallet.encryptedPrivateKey).toBe(mockEncryptedPrivateKey);
      expect(createdWallet.user.id).toBe(testUser.id);

      const dbWallet = await walletRepository.findOne({ where: { id: createdWallet.id } });
      expect(dbWallet).not.toBeNull();
      expect(dbWallet?.address).toBe(mockWalletAddress);
    });

    it('should create a wallet using a provided entity manager', async () => {
      const entityManager = walletRepository.manager;
      const spyCreate = jest.spyOn(entityManager, 'create');
      const spySave = jest.spyOn(entityManager, 'save');

      const createWalletParams = {
        network,
        encryptedPrivateKey: mockEncryptedPrivateKey,
        address: mockWalletAddress,
        userId: testUser.id,
        entityManager,
      };

      await walletService.createWallet(createWalletParams);

      expect(spyCreate).toHaveBeenCalled();
      expect(spySave).toHaveBeenCalled();
    });
  });

  describe('getWallets', () => {
    it('should return a formatted string of user wallets from Redis', async () => {
      const result = await walletService.getWallets(chatId);
      const bscWallet = testUser.wallets.find(w => w.network === Network.BSC);
      const polygonWallet = testUser.wallets.find(w => w.network === Network.POLYGON);

      expect(result).toContain('<u>Ваши кошельки:</u>');
      expect(result).toContain(`1. <b>${Network.BSC}:</b>\n<code>${bscWallet?.address}</code>`);
      expect(result).toContain(`2. <b>${Network.POLYGON}:</b>\n<code>${polygonWallet?.address}</code>`);
    });

    it('should throw BotError if user has no wallets in Redis', async () => {
      await redisService.addUser({
        chatId,
        userId: testUser!.id,
        action: 'get',
        wallets: [],
        tokens: [...testUser!.tokens],
        subscriptions: [...testUser!.subscriptions],
        replications: [],
      });
      await expect(walletService.getWallets(chatId)).rejects.toThrow(
        new BotError('You have no wallets', 'У вас нет кошельков', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('findByAddress', () => {
    it('should find and return a wallet by its address from the database', async () => {
      await walletService.createWallet({
        network,
        encryptedPrivateKey: mockEncryptedPrivateKey,
        address: mockWalletAddress,
        userId: testUser.id,
      });

      const foundWallet = await walletService.findByAddress(mockWalletAddress);

      expect(foundWallet).not.toBeNull();
      expect(foundWallet?.address).toBe(mockWalletAddress);
      expect(foundWallet?.network).toBe(network);
    });

    it('should return null if no wallet is found with the given address', async () => {
      const nonExistentAddress = '0x0000000000000000000000000000000000000000' as Address;
      const foundWallet = await walletService.findByAddress(nonExistentAddress);
      expect(foundWallet).toBeNull();
    });
  });
});
