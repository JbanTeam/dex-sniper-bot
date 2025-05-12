import { Test, TestingModule } from '@nestjs/testing';
import {
  ContractFunctionExecutionError,
  createPublicClient,
  createWalletClient,
  parseEther,
  PublicClient,
  WalletClient,
} from 'viem';
import * as crypto from '@src/utils/crypto';

import { ViemProvider } from '../viem.provider';
import { AnvilProvider } from '../anvil/anvil.provider';
import { ViemHelperProvider } from '../viem-helper.provider';
import { BotError } from '@src/errors/BotError';
import { User } from '@modules/user/user.entity';
import { Wallet } from '@modules/wallet/wallet.entity';
import { RedisService } from '@modules/redis/redis.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { SubscriptionService } from '@modules/subscription/subscription.service';
import { UnwatchCallback, ViemClientsType } from '../types';
import { Network, SessionUser, SessionUserToken, ViemNetwork } from '@src/types/types';

const mockNetwork: Network = 'BSC';

const mockUserSession = {
  userId: 1,
  chatId: 123,
  tokens: [],
  testTokens: [],
  wallets: [],
  subscriptions: [],
  replications: [],
} as SessionUser;

const mockWallet = {
  id: 1,
  address: '0xWalletAddress',
  network: Network.BSC,
  encryptedPrivateKey: 'privateKey',
  user: { id: 1 } as User,
} as Wallet;

const mockToken = {
  id: 1,
  address: '0xTokenAddress',
  name: 'PancakeSwap Token',
  symbol: 'Cake',
  decimals: 18,
  network: Network.BSC,
} as SessionUserToken;

const mockWalletClient = {
  getAddresses: jest.fn(),
  deployContract: jest.fn(),
  writeContract: jest.fn(),
  sendTransaction: jest.fn(),
} as unknown as WalletClient;

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

const mockRedisService = {
  existsInSet: jest.fn(),
  getTokens: jest.fn(),
  getUser: jest.fn(),
};

const mockSubscriptionService = {
  findSubscriptionsByAddress: jest.fn(),
};

const mockAnvilProvider = {
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

const mockConstantsProvider = {
  chains: {
    BSC: {
      tokenSymbol: 'BNB',
      tokenDecimals: 18,
      exchange: 'PancakeSwap',
      rpcUrl: 'https://bsc-dataseed.binance.org/',
    },
    POLYGON: {
      tokenSymbol: 'POL',
      tokenDecimals: 18,
      exchange: 'UniSwap',
      rpcUrl: 'https://polygon',
    },
  },
  notProd: true,
  ENCRYPT_KEY: 'privateKey',
};

jest.mock('viem', () => {
  const actual = jest.requireActual('viem') as unknown as object;
  return {
    ...actual,
    createPublicClient: jest.fn(),
    createWalletClient: jest.fn(),
  } as unknown;
});

describe('ViemProvider', () => {
  let viemProvider: ViemProvider;

  beforeEach(async () => {
    jest.clearAllMocks();

    (createWalletClient as jest.Mock).mockReturnValue(mockWalletClient);
    (createPublicClient as jest.Mock).mockReturnValue(mockPublicClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ViemProvider,
        { provide: RedisService, useValue: mockRedisService },
        { provide: SubscriptionService, useValue: mockSubscriptionService },
        { provide: AnvilProvider, useValue: mockAnvilProvider },
        { provide: ViemHelperProvider, useValue: mockViemHelperProvider },
        { provide: ConstantsProvider, useValue: mockConstantsProvider },
      ],
    }).compile();

    viemProvider = module.get<ViemProvider>(ViemProvider);

    viemProvider['clients'] = mockClients;
  });

  describe('onModuleInit', () => {
    it('should initialize clients and unwatch callbacks', async () => {
      mockViemHelperProvider.initAnvil.mockResolvedValue(undefined);
      mockViemHelperProvider.getClients.mockReturnValue(mockClients);
      mockViemHelperProvider.initUnwatchCallbacks.mockReturnValue(mockUnwatchCallbacks);
      jest.spyOn(viemProvider, 'monitorDex').mockResolvedValue(undefined);
      viemProvider['unwatchCallbacks'] = mockUnwatchCallbacks;
      await viemProvider.onModuleInit();

      expect(mockViemHelperProvider.getClients).toHaveBeenCalled();
      expect(mockViemHelperProvider.initUnwatchCallbacks).toHaveBeenCalled();
    });
  });

  describe('createWallet', () => {
    it('should create a wallet and set test balance', async () => {
      jest.spyOn(crypto, 'encryptPrivateKey').mockReturnValue('mockedEncryptedPrivateKey');
      mockViemHelperProvider.getClients.mockReturnValue(mockClients);
      mockAnvilProvider.setTestBalance.mockResolvedValue(undefined);

      const result = await viemProvider.createWallet(mockNetwork);

      expect(result.network).toBe(mockNetwork);
      expect(result.encryptedPrivateKey).toBe('mockedEncryptedPrivateKey');
      expect(mockAnvilProvider.setTestBalance).toHaveBeenCalled();
    });
  });

  describe('checkToken', () => {
    it('should check token details', async () => {
      mockViemHelperProvider.getPair.mockResolvedValue({
        pairAddress: '0xPairAddress',
        token0: '0xT0',
        token1: '0xT1',
      });

      mockViemHelperProvider.getClients.mockReturnValue(mockClients);

      const result = await viemProvider.checkToken({ address: mockToken.address, network: mockNetwork });

      expect(result).toBeDefined();
      expect(mockViemHelperProvider.getPair).toHaveBeenCalled();
    });

    it('should throw error when token address is not exist in network', async () => {
      mockViemHelperProvider.getPair.mockResolvedValue({ pairAddress: '0x123', token0: '0x123', token1: '0x123' });

      mockViemHelperProvider.getClients.mockReturnValue(mockClients);
      jest.spyOn(mockPublicClient, 'readContract').mockRejectedValue(ContractFunctionExecutionError);

      await expect(
        viemProvider.checkToken({
          address: '0xTokenAddress',
          network: mockNetwork,
        }),
      ).rejects.toThrow(BotError);
    });
  });

  describe('getBalance', () => {
    it('should get balance and format response', async () => {
      jest.spyOn(mockPublicClient, 'getBalance').mockResolvedValue(BigInt(1000));
      mockViemHelperProvider.getClients.mockReturnValue(mockClients);
      mockViemHelperProvider.formatBalanceResponse.mockResolvedValue('Адрес:');
      mockRedisService.getTokens.mockResolvedValue([]);

      const result = await viemProvider.getBalance({ chatId: 123, address: mockWallet.address, network: mockNetwork });

      expect(result).toContain('Адрес:');
      expect(mockRedisService.getTokens).toHaveBeenCalled();
    });
  });

  describe('sendTokens', () => {
    it('should send tokens', async () => {
      mockUserSession.testTokens = [mockToken];

      jest.spyOn(mockPublicClient, 'getBalance').mockResolvedValue(BigInt(1000));

      await viemProvider.sendTokens({
        userSession: mockUserSession,
        wallet: mockWallet,
        token: mockToken,
        amount: '10',
        recipientAddress: '0xRecipientAddress',
      });

      expect(mockViemHelperProvider.transfer).toHaveBeenCalled();
    });

    it('should throw error when balance is 0', async () => {
      mockUserSession.testTokens = [mockToken];

      jest.spyOn(mockPublicClient, 'getBalance').mockResolvedValue(BigInt(0));

      await expect(
        viemProvider.sendTokens({
          userSession: mockUserSession,
          wallet: mockWallet,
          token: mockToken,
          amount: '10',
          recipientAddress: '0xRecipientAddress',
        }),
      ).rejects.toThrow(BotError);
    });
  });

  describe('sendNative', () => {
    it('should send native currency', async () => {
      mockViemHelperProvider.transferNative.mockResolvedValue(undefined);
      jest.spyOn(mockPublicClient, 'getBalance').mockResolvedValue(parseEther('1000'));

      await viemProvider.sendNative({
        userSession: mockUserSession,
        wallet: mockWallet,
        amount: '10',
        recipientAddress: '0xRecipientAddress',
      });

      expect(mockViemHelperProvider.transferNative).toHaveBeenCalled();
    });

    it('should throw error when balance is 0', async () => {
      mockViemHelperProvider.transferNative.mockResolvedValue(undefined);
      jest.spyOn(mockPublicClient, 'getBalance').mockResolvedValue(parseEther('0'));

      await expect(
        viemProvider.sendNative({
          userSession: mockUserSession,
          wallet: mockWallet,
          amount: '10',
          recipientAddress: '0xRecipientAddress',
        }),
      ).rejects.toThrow(BotError);
    });
  });
});
