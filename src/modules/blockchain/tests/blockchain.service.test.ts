import { Test, TestingModule } from '@nestjs/testing';

import { BlockchainService } from '../blockchain.service';
import { ViemProvider } from '../viem/viem.provider';
import { AnvilProvider } from '../viem/anvil/anvil.provider';
import { WalletService } from '@modules/wallet/wallet.service';
import { Network, SessionUser, SessionWallet } from '@src/types/types';
import { Wallet } from '@modules/wallet/wallet.entity';
import { SessionUserToken } from '@src/types/types';
import { User } from '@modules/user/user.entity';

const mockWallet = {
  id: 1,
  address: '0xWalletAddress',
  network: Network.BSC,
  encryptedPrivateKey: 'privateKey',
  user: { id: 1 } as User,
} as Wallet;

const mockSessionWallet = {
  id: 1,
  address: '0xWalletAddress',
  network: Network.BSC,
  encryptedPrivateKey: 'privateKey',
} as SessionWallet;

const mockToken = {
  id: 1,
  address: '0xTokenAddress',
  name: 'Token',
  symbol: 'TKN',
  decimals: 18,
  network: Network.BSC,
} as SessionUserToken;

const mockUserSession = {
  userId: 1,
  chatId: 123,
  tokens: [],
  wallets: [],
  subscriptions: [],
  replications: [],
} as SessionUser;

describe('BlockchainService', () => {
  let blockchainService: BlockchainService;
  let mockViemProvider: Partial<ViemProvider>;
  let mockAnvilProvider: Partial<AnvilProvider>;
  let mockWalletService: Partial<WalletService>;

  beforeEach(async () => {
    mockViemProvider = {
      createWallet: jest.fn(),
      checkToken: jest.fn(),
      getBalance: jest.fn(),
      sendTokens: jest.fn(),
      sendNative: jest.fn(),
      monitorDex: jest.fn(),
      stopMonitoring: jest.fn(),
    };

    mockAnvilProvider = {
      createTestToken: jest.fn(),
      fakeSwapTo: jest.fn(),
      fakeSwapFrom: jest.fn(),
      setTestBalance: jest.fn(),
    };

    mockWalletService = {
      createWallet: jest.fn(),
      findByAddress: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainService,
        { provide: ViemProvider, useValue: mockViemProvider },
        { provide: AnvilProvider, useValue: mockAnvilProvider },
        { provide: WalletService, useValue: mockWalletService },
      ],
    }).compile();

    blockchainService = module.get<BlockchainService>(BlockchainService);
  });

  describe('createWallet', () => {
    it('should create wallet successfully', async () => {
      const createWalletParams = {
        address: '0xWalletAddress',
        encryptedPrivateKey: 'privateKey',
        network: Network.BSC,
      };
      const mockSavedWallet = { id: 1, ...createWalletParams } as Wallet;

      mockViemProvider.createWallet = jest.fn().mockResolvedValue(createWalletParams);
      mockWalletService.createWallet = jest.fn().mockResolvedValue(mockSavedWallet);
      mockAnvilProvider.setTestBalance = jest.fn().mockResolvedValue(undefined);

      const result = await blockchainService.createWallet({
        userId: 1,
        network: Network.BSC,
      });

      expect(result).toEqual(mockSavedWallet);
      expect(mockViemProvider.createWallet).toHaveBeenCalledWith(Network.BSC);
      expect(mockWalletService.createWallet).toHaveBeenCalled();
    });

    it('should throw error when wallet creation fails', async () => {
      mockViemProvider.createWallet = jest.fn().mockRejectedValue(new Error('Creation failed'));

      await expect(
        blockchainService.createWallet({
          userId: 1,
          network: Network.BSC,
        }),
      ).rejects.toThrow(Error);
    });
  });

  describe('checkToken', () => {
    it('should check token successfully', async () => {
      const mockTokenInfo = {
        name: 'Token',
        symbol: 'TKN',
        decimals: 18,
      };
      mockViemProvider.checkToken = jest.fn().mockResolvedValue(mockTokenInfo);

      const result = await blockchainService.checkToken({
        address: '0x123',
        network: Network.BSC,
      });

      expect(result).toEqual(mockTokenInfo);
      expect(mockViemProvider.checkToken).toHaveBeenCalledWith({
        address: '0x123',
        network: Network.BSC,
      });
    });
  });

  describe('getBalance', () => {
    it('should get balance successfully', async () => {
      const mockBalance = 'Balance: 1000';
      mockViemProvider.getBalance = jest.fn().mockResolvedValue(mockBalance);

      const result = await blockchainService.getBalance({
        chatId: 123,
        address: '0xTokenAddress',
        network: Network.BSC,
      });

      expect(result).toEqual(mockBalance);
      expect(mockViemProvider.getBalance).toHaveBeenCalledWith({
        chatId: 123,
        address: '0xTokenAddress',
        network: Network.BSC,
      });
    });
  });

  describe('sendTokens', () => {
    it('should send tokens successfully', async () => {
      mockViemProvider.sendTokens = jest.fn().mockResolvedValue(undefined);

      await blockchainService.sendTokens({
        userSession: mockUserSession,
        wallet: mockWallet,
        token: mockToken,
        amount: '100',
        recipientAddress: '0xRecipientAddress',
      });

      expect(mockViemProvider.sendTokens).toHaveBeenCalled();
    });
  });

  describe('sendNative', () => {
    it('should send native currency successfully', async () => {
      mockViemProvider.sendNative = jest.fn().mockResolvedValue(undefined);

      await blockchainService.sendNative({
        userSession: mockUserSession,
        wallet: mockWallet,
        amount: '1',
        recipientAddress: '0xRecipientAddress',
      });

      expect(mockViemProvider.sendNative).toHaveBeenCalled();
    });
  });

  describe('createTestToken', () => {
    it('should create test token successfully', async () => {
      const mockResult = {
        token: {
          ...mockToken,
          address: '0xTokenAddress',
        },
        pairAddresses: {
          pairAddress: '0xPairAddress',
          token0: '0xT0',
          token1: '0xT1',
        },
      };

      mockAnvilProvider.createTestToken = jest.fn().mockResolvedValue(mockResult);

      const result = await blockchainService.createTestToken({
        wallet: mockSessionWallet,
        token: mockToken,
      });

      expect(result).toEqual(mockResult);
      expect(mockAnvilProvider.createTestToken).toHaveBeenCalledWith({
        walletAddress: '0xWalletAddress',
        token: mockToken,
      });
    });
  });
});
