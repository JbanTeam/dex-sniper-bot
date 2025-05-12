import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';

import { TgQueryHandler } from '../TgQueryHandler';
import { RedisService } from '@modules/redis/redis.service';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { SubscriptionService } from '@modules/subscription/subscription.service';
import { UserTokenService } from '@modules/user-token/user-token.service';
import { ReplicationService } from '@modules/replication/replication.service';
import { WalletService } from '@modules/wallet/wallet.service';
import { IncomingQuery, Network, SessionUser, SessionUserToken, SessionWallet } from '@src/types/types';
import { BotError } from '@src/errors/BotError';
import { User } from '@modules/user/user.entity';
import { Wallet } from '@modules/wallet/wallet.entity';

const mockQuery: IncomingQuery = {
  timestamp: new Date(),
  query_id: 1,
  chatId: 123,
  data: '',
  messageId: 1,
  user: { id: 1, username: 'testuser' },
};

const mockTokenAddress = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';
const mockRecipientAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

const mockSessionToken = {
  id: 1,
  address: '0xTokenAddress',
  network: 'BSC',
  name: 'Test Token',
  symbol: 'TT',
  decimals: 18,
  replications: [],
} as SessionUserToken;

const mockWallet = {
  id: 1,
  address: '0xWalletAddress',
  network: Network.BSC,
  encryptedPrivateKey: '',
} as SessionWallet;

const mockFullWallet = {
  id: 1,
  address: '0xWalletAddress',
  network: Network.BSC,
  encryptedPrivateKey: 'encKey',
  user: { id: 1 } as User,
  createdAt: new Date(),
  updatedAt: new Date(),
  tokens: [],
  replications: [],
  subscriptions: [],
} as Wallet;

const mockRedisService = {
  getUser: jest.fn(),
  setUserField: jest.fn(),
  getWallets: jest.fn(),
  getTokens: jest.fn(),
  getTempWallet: jest.fn(),
  getTempReplication: jest.fn(),
  getTempSendTokens: jest.fn(),
};

const mockTokenService = {
  addToken: jest.fn(),
  removeToken: jest.fn(),
};

const mockBlockchainService = {
  getBalance: jest.fn(),
  sendNative: jest.fn(),
  sendTokens: jest.fn(),
};

const mockSubscriptionService = {
  subscribeToWallet: jest.fn(),
};

const mockReplicationService = {
  createOrUpdateReplication: jest.fn(),
  setReplicationSubscription: jest.fn(),
};

const mockWalletService = {
  findByAddress: jest.fn(),
};

const mockUserSession = {
  userId: 1,
  chatId: 123,
  tempToken: '0xTempTokenAddress',
  tokens: [],
  wallets: [],
  subscriptions: [],
  replications: [],
} as SessionUser;

const mockConstants = {
  chains: {
    BSC: {
      name: 'Binance Smart Chain',
      tokenSymbol: 'BNB',
      tokenDecimals: 18,
      exchange: 'PancakeSwap',
      rpcUrl: 'https://bsc-dataseed.binance.org/',
    },
    POLYGON: {
      name: 'Polygon',
      tokenSymbol: 'MATIC',
      tokenDecimals: 18,
      exchange: 'QuickSwap',
      rpcUrl: 'https://polygon-rpc.com/',
    },
  },
  NODE_ENV: 'test',
};

describe('TgQueryHandler', () => {
  let handler: TgQueryHandler;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TgQueryHandler,
        { provide: UserTokenService, useValue: mockTokenService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: BlockchainService, useValue: mockBlockchainService },
        { provide: SubscriptionService, useValue: mockSubscriptionService },
        { provide: ReplicationService, useValue: mockReplicationService },
        { provide: WalletService, useValue: mockWalletService },
        { provide: ConstantsProvider, useValue: mockConstants },
        {
          provide: Logger,
          useValue: { debug: jest.fn(), error: jest.fn(), log: jest.fn(), verbose: jest.fn(), warn: jest.fn() },
        },
      ],
    }).compile();

    handler = module.get<TgQueryHandler>(TgQueryHandler);
  });

  describe('handleQuery', () => {
    it('should handle add- token query', async () => {
      mockQuery.data = 'add-BSC';
      jest.spyOn(handler, 'addTokenCb');
      await handler.handleQuery(mockQuery);
      expect(handler.addTokenCb).toHaveBeenCalledWith(mockQuery);
    });

    it('should handle rm- token query', async () => {
      mockQuery.data = 'rm-BSC';
      jest.spyOn(handler, 'removeTokenCb');
      await handler.handleQuery(mockQuery);
      expect(handler.removeTokenCb).toHaveBeenCalledWith(mockQuery);
    });

    it('should handle balance- query', async () => {
      mockQuery.data = 'balance-1';
      jest.spyOn(handler, 'getBalanceCb');
      await handler.handleQuery(mockQuery);
      expect(handler.getBalanceCb).toHaveBeenCalledWith(mockQuery);
    });

    it('should handle subnet- query', async () => {
      mockQuery.data = 'subnet-BSC';
      jest.spyOn(handler, 'subscribeCb');
      await handler.handleQuery(mockQuery);
      expect(handler.subscribeCb).toHaveBeenCalledWith(mockQuery);
    });

    it('should handle repl- query', async () => {
      mockQuery.data = 'repl-1-BSC';
      jest.spyOn(handler as any, 'replicateSetSubscription');
      await handler.handleQuery(mockQuery);
      expect(handler['replicateSetSubscription']).toHaveBeenCalledWith(mockQuery);
    });

    it('should handle repltoken- query', async () => {
      mockQuery.data = 'repltoken-1';
      jest.spyOn(handler, 'replicateCb');
      await handler.handleQuery(mockQuery);
      expect(handler.replicateCb).toHaveBeenCalledWith(mockQuery);
    });

    it('should handle send- query', async () => {
      mockQuery.data = 'send-1';
      jest.spyOn(handler, 'sendTokensCb');
      await handler.handleQuery(mockQuery);
      expect(handler.sendTokensCb).toHaveBeenCalledWith(mockQuery);
    });

    it('should handle unknown query', async () => {
      mockQuery.data = 'unknown-query';
      const result = await handler.handleQuery(mockQuery);
      expect(result.text).toBe('Неизвестная команда');
    });
  });

  describe('addTokenCb', () => {
    it('should add token successfully', async () => {
      mockQuery.data = 'add-BSC';
      mockUserSession.tempToken = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';
      mockRedisService.getUser.mockResolvedValue(mockUserSession);
      mockTokenService.addToken.mockResolvedValue('Token added');
      const result = await handler.addTokenCb(mockQuery);
      expect(mockRedisService.getUser).toHaveBeenCalledWith(mockQuery.chatId);
      expect(mockTokenService.addToken).toHaveBeenCalledWith({
        userSession: mockUserSession,
        address: mockUserSession.tempToken,
        network: 'BSC',
      });
      expect(result.text).toContain('Токен успешно добавлен 🔥🔥🔥');
    });

    it('should handle error if tempToken not found', async () => {
      mockQuery.data = 'add-BSC';
      mockRedisService.getUser.mockResolvedValue({ ...mockUserSession, tempToken: undefined });
      const result = await handler.addTokenCb(mockQuery);
      expect(result.text).toBe('Токен не найден');
    });

    it('should return error text if network not found in query data', async () => {
      mockQuery.data = 'add-';
      mockUserSession.tempToken = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';
      mockRedisService.getUser.mockResolvedValue(mockUserSession);
      const result = await handler.addTokenCb(mockQuery);
      expect(result.text).toBe('Сеть не найдена');
    });

    it('should return error text if tokenService.addToken throws error', async () => {
      mockQuery.data = 'add-BSC';
      mockRedisService.getUser.mockResolvedValue(mockUserSession);
      mockTokenService.addToken.mockRejectedValue(
        new BotError('Error while adding token', 'Ошибка при добавлении токена', 500),
      );
      const result = await handler.addTokenCb(mockQuery);
      expect(result.text).toBe('Ошибка при добавлении токена');
    });
  });

  describe('removeTokenCb', () => {
    it('should remove all tokens successfully', async () => {
      mockQuery.data = 'rm-all';
      mockTokenService.removeToken.mockResolvedValue(undefined);
      const result = await handler.removeTokenCb(mockQuery);
      expect(mockTokenService.removeToken).toHaveBeenCalledWith({ chatId: mockQuery.chatId });
      expect(result.text).toBe('Все токены успешно удалены 🔥🔥🔥');
    });

    it('should remove tokens by network successfully', async () => {
      mockQuery.data = 'rm-BSC';
      mockTokenService.removeToken.mockResolvedValue(undefined);
      const result = await handler.removeTokenCb(mockQuery);
      expect(mockTokenService.removeToken).toHaveBeenCalledWith({ chatId: mockQuery.chatId, network: 'BSC' });
      expect(result.text).toBe('Все токены в сети BSC успешно удалены 🔥🔥🔥');
    });

    it('should return error text if network is invalid', async () => {
      mockQuery.data = 'rm-INVALID';
      const result = await handler.removeTokenCb(mockQuery);
      expect(result.text).toContain('Неверные данные запроса');
    });

    it('should return error text if tokenService.removeToken throws error', async () => {
      mockQuery.data = 'rm-BSC';
      mockTokenService.removeToken.mockRejectedValue(
        new BotError('Error while deleting token', 'Ошибка при удалении токенов', 500),
      );
      const result = await handler.removeTokenCb(mockQuery);
      expect(result.text).toBe('Ошибка при удалении токенов');
    });
  });

  describe('getBalanceCb', () => {
    it('should get balance successfully', async () => {
      mockQuery.data = 'balance-1';
      mockRedisService.getWallets.mockResolvedValue([mockWallet]);
      mockBlockchainService.getBalance.mockResolvedValue('Balance: 100');
      const result = await handler.getBalanceCb(mockQuery);
      expect(mockRedisService.getWallets).toHaveBeenCalledWith(mockQuery.chatId);
      expect(mockBlockchainService.getBalance).toHaveBeenCalledWith({
        chatId: mockQuery.chatId,
        address: mockWallet.address,
        network: mockWallet.network,
      });
      expect(result.text).toBe('Balance: 100');
    });

    it('should return error text if wallet not found', async () => {
      mockQuery.data = 'balance-2';
      mockRedisService.getWallets.mockResolvedValue([mockWallet]);
      const result = await handler.getBalanceCb(mockQuery);
      expect(result.text).toBe('Кошелек не найден');
    });

    it('should return error text if no wallets found for user', async () => {
      mockQuery.data = 'balance-1';
      mockRedisService.getWallets.mockResolvedValue(null);
      const result = await handler.getBalanceCb(mockQuery);
      expect(result.text).toBe('Кошелек не найден');
    });

    it('should return error text if blockchainService.getBalance throws error', async () => {
      mockQuery.data = 'balance-1';
      mockRedisService.getWallets.mockResolvedValue([mockWallet]);
      mockBlockchainService.getBalance.mockRejectedValue(
        new BotError('Error while getting balance', 'Ошибка получения баланса', 500),
      );
      const result = await handler.getBalanceCb(mockQuery);
      expect(result.text).toBe('Ошибка получения баланса');
    });
  });

  describe('subscribeCb', () => {
    it('should subscribe to wallet successfully', async () => {
      mockQuery.data = 'subnet-BSC';
      mockRedisService.getTempWallet.mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
      mockSubscriptionService.subscribeToWallet.mockResolvedValue(undefined);
      const result = await handler.subscribeCb(mockQuery);
      expect(mockRedisService.getTempWallet).toHaveBeenCalledWith(mockQuery.chatId);
      expect(result.text).toBe('Кошелек добавлен в список для отслеживания ✅');
    });

    it('should handle error if tempWallet not found', async () => {
      mockQuery.data = 'subnet-BSC';
      mockRedisService.getTempWallet.mockResolvedValue(null);
      const result = await handler.subscribeCb(mockQuery);
      expect(result.text).toBe('Кошелек не найден');
    });

    it('should return error text if network missing', async () => {
      mockQuery.data = 'subnet-';
      mockRedisService.getTempWallet.mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
      const result = await handler.subscribeCb(mockQuery);
      expect(result.text).toBe('Сеть не найдена');
    });

    it('should return error text if wallet address invalid', async () => {
      mockQuery.data = 'subnet-BSC';
      mockRedisService.getTempWallet.mockResolvedValue('0xTempWalletAddress');
      const result = await handler.subscribeCb(mockQuery);
      expect(result.text).toBe('Неверный формат адреса');
    });
  });

  describe('replicateSetSubscription', () => {
    it('should show keyboard to choose token for replicate', async () => {
      mockQuery.data = 'repl-1-BSC';
      mockRedisService.getTempReplication.mockResolvedValue({});
      mockRedisService.setUserField.mockResolvedValue(undefined);
      mockRedisService.getTokens.mockResolvedValue([mockSessionToken]);

      const result = await handler['replicateSetSubscription'](mockQuery);

      expect(result.text).toBe('Выберите токен для установки параметров:');
    });

    it('should return error text if network is missing', async () => {
      mockQuery.data = 'repl-1-';
      const result = await handler['replicateSetSubscription'](mockQuery);
      expect(result.text).toContain('Неверная сеть');
    });

    it('should return error text if tempReplication is null', async () => {
      mockQuery.data = 'repl-1-BSC';
      mockRedisService.getTempReplication.mockResolvedValue(null);

      const result = await handler['replicateSetSubscription'](mockQuery);

      expect(result.text).toBe('Не удалось установить повтор сделок');
    });
  });

  describe('replicateCb', () => {
    it('should set replicate parameters successfully', async () => {
      mockQuery.data = 'repltoken-1';
      mockRedisService.getTempReplication.mockResolvedValue({});
      mockReplicationService.createOrUpdateReplication.mockResolvedValue('Replication done');
      const result = await handler.replicateCb(mockQuery);

      expect(result.text).toContain('Параметры повтора сделок установлены ✅');
      expect(result.options).toEqual({ parse_mode: 'html' });
    });

    it('should return error text if tokenId is missing', async () => {
      mockQuery.data = 'repltoken-';
      mockRedisService.getTempReplication.mockResolvedValue(null);

      const result = await handler.replicateCb(mockQuery);
      expect(result.text).toContain('Не удалось установить повтор сделок');
    });
  });

  describe('sendTokensCb', () => {
    const mockUserSessionWithWallet: SessionUser = {
      ...mockUserSession,
      wallets: [mockWallet],
      tokens: [mockSessionToken],
    };

    it('should send native tokens successfully', async () => {
      mockQuery.data = 'send-BSC';
      mockRedisService.getTempSendTokens.mockResolvedValue(`native:1:${mockRecipientAddress}`);
      mockRedisService.getUser.mockResolvedValue(mockUserSessionWithWallet);
      mockWalletService.findByAddress.mockResolvedValue(mockFullWallet);
      mockBlockchainService.sendNative.mockResolvedValue(undefined);

      const result = await handler.sendTokensCb(mockQuery);

      expect(mockRedisService.getTempSendTokens).toHaveBeenCalledWith(mockQuery.chatId);
      expect(mockRedisService.getUser).toHaveBeenCalledWith(mockQuery.chatId);
      expect(mockWalletService.findByAddress).toHaveBeenCalledWith(mockWallet.address);
      expect(mockBlockchainService.sendNative).toHaveBeenCalledWith({
        userSession: mockUserSessionWithWallet,
        wallet: mockFullWallet,
        amount: '1',
        recipientAddress: mockRecipientAddress,
      });
      expect(result.text).toBe(`${mockConstants.chains.BSC.tokenSymbol} успешно отправлены ✅`);
    });

    it('should send tokens successfully', async () => {
      mockQuery.data = 'send-BSC';
      mockSessionToken.address = mockTokenAddress;
      mockRedisService.getTempSendTokens.mockResolvedValue(`${mockTokenAddress}:1:${mockRecipientAddress}`);
      mockRedisService.getUser.mockResolvedValue(mockUserSessionWithWallet);
      mockWalletService.findByAddress.mockResolvedValue(mockFullWallet);
      mockBlockchainService.sendTokens.mockResolvedValue(undefined);

      const result = await handler.sendTokensCb(mockQuery);

      expect(mockBlockchainService.sendTokens).toHaveBeenCalledWith({
        userSession: mockUserSessionWithWallet,
        wallet: mockFullWallet,
        token: mockSessionToken,
        amount: '1',
        recipientAddress: mockRecipientAddress,
      });
      expect(result.text).toBe(`${mockSessionToken.symbol} успешно отправлены ✅`);
    });

    it('should return error text if tempSendTokens is not found', async () => {
      mockQuery.data = 'send-BSC';
      mockRedisService.getTempSendTokens.mockResolvedValue(null);

      const result = await handler.sendTokensCb(mockQuery);

      expect(result.text).toBe('Ошибка отправки токенов');
    });

    it('should return error text if invalid amount', async () => {
      mockQuery.data = 'send-BSC';
      mockRedisService.getTempSendTokens.mockResolvedValue(`native:invalidAmount:${mockRecipientAddress}`);
      mockRedisService.getUser.mockResolvedValue(mockUserSessionWithWallet);

      const result = await handler.sendTokensCb(mockQuery);
      expect(result.text).toBe('Введите корректное количество токенов');
    });

    it('should return error text if wallet not found in user session', async () => {
      mockQuery.data = 'send-BSC';
      mockRedisService.getTempSendTokens.mockResolvedValue(`native:1:${mockRecipientAddress}`);
      mockRedisService.getUser.mockResolvedValue({ ...mockUserSession, wallets: [] });

      const result = await handler.sendTokensCb(mockQuery);
      expect(result.text).toBe('Кошелек не найден');
    });

    it('should return error text if full wallet not found by address', async () => {
      mockQuery.data = 'send-BSC';
      mockRedisService.getTempSendTokens.mockResolvedValue(`native:1:${mockRecipientAddress}`);
      mockRedisService.getUser.mockResolvedValue(mockUserSessionWithWallet);
      mockWalletService.findByAddress.mockResolvedValue(null);

      const result = await handler.sendTokensCb(mockQuery);
      expect(result.text).toBe('Кошелек не найден');
    });

    it('should return error text if token not found in user session', async () => {
      mockQuery.data = 'send-BSC';
      mockSessionToken.address = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE89';
      mockRedisService.getTempSendTokens.mockResolvedValue(`${mockTokenAddress}:1:${mockRecipientAddress}`);
      mockRedisService.getUser.mockResolvedValue(mockUserSessionWithWallet);
      mockWalletService.findByAddress.mockResolvedValue(mockFullWallet);

      const result = await handler.sendTokensCb(mockQuery);
      expect(result.text).toBe('Токен не найден в списке добавленных');
    });

    it('should return error text if blockchainService.sendNative throws error', async () => {
      mockQuery.data = 'send-BSC';
      mockRedisService.getTempSendTokens.mockResolvedValue(`native:1:${mockRecipientAddress}`);

      mockRedisService.getUser.mockResolvedValue(mockUserSessionWithWallet);
      mockWalletService.findByAddress.mockResolvedValue(mockFullWallet);
      mockBlockchainService.sendNative.mockRejectedValue(
        new BotError('Error while sending tokens', 'Ошибка при отправке токенов', 500),
      );

      const result = await handler.sendTokensCb(mockQuery);
      expect(result.text).toBe('Ошибка при отправке токенов');
    });

    it('should return error text if blockchainService.sendTokens throws error', async () => {
      mockQuery.data = 'send-BSC';
      mockSessionToken.address = mockTokenAddress;
      mockRedisService.getTempSendTokens.mockResolvedValue(`${mockTokenAddress}:1:${mockRecipientAddress}`);
      mockRedisService.getUser.mockResolvedValue(mockUserSessionWithWallet);
      mockWalletService.findByAddress.mockResolvedValue(mockFullWallet);
      mockBlockchainService.sendTokens.mockRejectedValue(
        new BotError('Error while sending tokens', 'Ошибка при отправке токенов', 500),
      );

      const result = await handler.sendTokensCb(mockQuery);
      expect(result.text).toBe('Ошибка при отправке токенов');
    });

    it('should return error text if invalid network', async () => {
      mockQuery.data = 'send-INVALID';
      mockRedisService.getTempSendTokens = jest.fn().mockResolvedValue('native:1:0xRecipientAddress');
      const result = await handler.sendTokensCb(mockQuery);
      expect(result.text).toBe('Неверная сеть');
    });

    it('should return error text if invalid recipient address', async () => {
      mockQuery.data = 'send-BSC';
      mockRedisService.getTempSendTokens.mockResolvedValue(`${mockTokenAddress}:1:invalidRecipient`);
      const result = await handler.sendTokensCb(mockQuery);
      expect(result.text).toBe('Неверный формат адреса');
    });

    it('should return error text if invalid token address when sending tokens', async () => {
      mockQuery.data = 'send-BSC';
      mockRedisService.getTempSendTokens.mockResolvedValue(`invalidTokenAddress:1:${mockRecipientAddress}`);
      mockRedisService.getUser.mockResolvedValue(mockUserSessionWithWallet);
      const result = await handler.sendTokensCb(mockQuery);
      expect(result.text).toBe('Неверный формат адреса');
    });
  });
});
