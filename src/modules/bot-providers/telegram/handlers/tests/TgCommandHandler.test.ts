import { Test, TestingModule } from '@nestjs/testing';

import { TgCommandHandler } from '../TgCommandHandler';
import { RedisService } from '@modules/redis/redis.service';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { SubscriptionService } from '@modules/subscription/subscription.service';
import { UserTokenService } from '@modules/user-token/user-token.service';
import { ReplicationService } from '@modules/replication/replication.service';
import { WalletService } from '@modules/wallet/wallet.service';
import { IncomingMessage, SessionSubscription, SessionUser, SessionUserToken } from '@src/types/types';

const mockMessage: IncomingMessage = {
  timestamp: new Date(),
  chatId: 123,
  text: '',
  messageId: 1,
  user: { id: 1, username: 'testuser' },
};

const mockRedisService = {
  existsInSet: jest.fn(),
  setUserField: jest.fn(),
  getUser: jest.fn(),
  getTokens: jest.fn(),
  getWallets: jest.fn(),
  setHashFields: jest.fn(),
};

const mockTokenService = {
  removeToken: jest.fn(),
  getTokens: jest.fn(),
};

const mockBlockchainService = {
  fakeSwapTo: jest.fn(),
  fakeSwapFrom: jest.fn(),
};

const mockSubscriptionService = {
  unsubscribeFromWallet: jest.fn(),
  getSubscriptions: jest.fn(),
};

const mockReplicationService = {
  getReplications: jest.fn(),
};

const mockWalletService = {
  getWallets: jest.fn(),
};

const mockSessionToken = {
  id: 1,
  address: '0xTokenAddress',
  network: 'BSC',
  name: 'Test Token',
  symbol: 'TT',
  decimals: 18,
  replications: [],
} as SessionUserToken;

const mockUserSession = {
  userId: 1,
  chatId: 123,
  tokens: [],
  testTokens: [],
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
      tokenSymbol: 'POl',
      tokenDecimals: 18,
      exchange: 'UniSwap',
      rpcUrl: 'https://polygon-rpc.com/',
    },
  },
  NODE_ENV: 'test',
};

describe('TgCommandHandler', () => {
  let handler: TgCommandHandler;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TgCommandHandler,
        { provide: RedisService, useValue: mockRedisService },
        { provide: UserTokenService, useValue: mockTokenService },
        { provide: BlockchainService, useValue: mockBlockchainService },
        { provide: SubscriptionService, useValue: mockSubscriptionService },
        { provide: ReplicationService, useValue: mockReplicationService },
        { provide: WalletService, useValue: mockWalletService },
        { provide: ConstantsProvider, useValue: mockConstants },
      ],
    }).compile();

    handler = module.get<TgCommandHandler>(TgCommandHandler);
  });

  describe('handleCommand', () => {
    it('should handle /start command', async () => {
      mockMessage.text = '/start';
      const result = await handler.handleCommand(mockMessage);
      expect(result).toHaveProperty('text');
    });

    it('should handle unknown command', async () => {
      mockMessage.text = '/unknown';
      const result = await handler.handleCommand(mockMessage);
      expect(result.text).toContain('Неизвестная команда');
    });
  });

  describe('addToken', () => {
    it('should validate token address', async () => {
      mockMessage.text = '/addtoken invalid';
      mockRedisService.existsInSet.mockResolvedValue(1);

      const result = await handler.addToken(mockMessage);
      expect(result.text).toBe('Введите корректный адрес токена. Пример: /addtoken [адрес_токена]');
    });

    it('should check user exists', async () => {
      mockMessage.text = '/addtoken 0x123';
      mockRedisService.existsInSet.mockResolvedValue(0);

      const result = await handler.addToken(mockMessage);

      expect(result.text).toBe('Пользователь не найден');
    });

    it('should set temp token and show network selection', async () => {
      mockMessage.text = '/addtoken 0x1234567890123456789012345678901234567890';
      mockRedisService.existsInSet.mockResolvedValue(1);
      const result = await handler.addToken(mockMessage);
      expect(mockRedisService.setUserField).toHaveBeenCalled();
      expect(result.options?.reply_markup).toBeDefined();
    });
  });

  describe('removeToken', () => {
    it('should return error text when no tokens exist', async () => {
      mockMessage.text = '/removetoken';
      mockRedisService.getUser.mockResolvedValue({ tokens: [] });
      const result = await handler.removeToken(mockMessage);

      expect(result.text).toBe('У вас нет сохраненных токенов');
    });

    it('should show network selection when no address provided', async () => {
      mockMessage.text = '/removetoken';
      mockRedisService.getUser.mockResolvedValue({ tokens: [mockSessionToken], wallets: [] });
      const result = await handler.removeToken(mockMessage);
      expect(result.options?.reply_markup).toBeDefined();
    });
  });

  describe('getTokens', () => {
    it('should call tokenService.getTokens', async () => {
      mockMessage.text = '/tokens';
      mockTokenService.getTokens.mockResolvedValue('test tokens');
      const result = await handler.getTokens(mockMessage);
      expect(mockTokenService.getTokens).toHaveBeenCalled();
      expect(result.text).toBe('test tokens');
    });
  });

  describe('getWallets', () => {
    it('should call walletService.getWallets', async () => {
      mockMessage.text = '/wallets';
      mockWalletService.getWallets.mockResolvedValue('test wallets');
      const result = await handler.getWallets(mockMessage);
      expect(mockWalletService.getWallets).toHaveBeenCalled();
      expect(result.text).toBe('test wallets');
    });
  });

  describe('subscribe', () => {
    it('should validate wallet address', async () => {
      mockMessage.text = '/follow invalid';
      const result = await handler.subscribe(mockMessage);

      expect(result.text).toBe('Введите корректный адрес кошелька. Пример: /follow [адрес_кошелька]');
    });

    it('should set temp wallet and show exchange selection', async () => {
      mockMessage.text = '/follow 0x1234567890123456789012345678901234567890';
      jest.spyOn(mockRedisService, 'setUserField').mockResolvedValue(undefined);

      const result = await handler.subscribe(mockMessage);
      expect(mockRedisService.setUserField).toHaveBeenCalled();
      expect(result.text).toBe('Выберите обменник, на котором вы хотите отслеживать транзакции данного кошелька:');
    });
  });

  describe('unsubscribe', () => {
    it('should validate wallet address', async () => {
      mockMessage.text = '/unfollow invalid';
      const result = await handler.unsubscribe(mockMessage);

      expect(result.text).toBe('Введите корректный адрес кошелька. Пример: /follow [адрес_кошелька]');
    });

    it('should unsubscribe from wallet', async () => {
      mockMessage.text = '/unfollow 0x1234567890123456789012345678901234567890';
      jest.spyOn(mockSubscriptionService, 'unsubscribeFromWallet').mockResolvedValue(undefined);

      const result = await handler.unsubscribe(mockMessage);
      expect(mockSubscriptionService.unsubscribeFromWallet).toHaveBeenCalled();
      expect(result.text).toBe('Вы успешно отписались от кошелька ✅');
    });
  });

  describe('getSubscriptions', () => {
    it('should get subscriptions', async () => {
      mockMessage.text = '/subscriptions';
      mockSubscriptionService.getSubscriptions.mockResolvedValue('test subscriptions');
      const result = await handler.getSubscriptions(mockMessage);
      expect(mockSubscriptionService.getSubscriptions).toHaveBeenCalled();
      expect(result.text).toBe('test subscriptions');
    });
  });

  describe('replicate', () => {
    it('should show subscriptions addresses to choose', async () => {
      mockMessage.text = '/replicate buy 100';
      mockUserSession.subscriptions = [{} as SessionSubscription];
      mockUserSession.tokens = [{} as SessionUserToken];
      jest.spyOn(mockRedisService, 'getUser').mockResolvedValue(mockUserSession);
      const result = await handler.replicate(mockMessage);

      expect(result.text).toBe('Выберите адрес подписки для установки параметров:');
    });

    it('should return error text if incorrect command', async () => {
      mockMessage.text = '/replicate invalid';
      jest.spyOn(mockRedisService, 'getUser').mockResolvedValue(mockUserSession);
      const result = await handler.replicate(mockMessage);

      expect(result.text).toBe('Введите корректную команду. Пример: /replicate buy 100');
    });
  });

  describe('getReplications', () => {
    it('should get replications', async () => {
      mockMessage.text = '/replications';
      mockReplicationService.getReplications.mockResolvedValue('test replications');
      const result = await handler.getReplications(mockMessage);
      expect(mockReplicationService.getReplications).toHaveBeenCalled();
      expect(result.text).toBe('test replications');
    });
  });

  describe('sendTokens', () => {
    it('should show keyboard of networks to choose', async () => {
      mockMessage.text =
        '/send 0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82 100 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
      jest.spyOn(mockRedisService, 'setHashFields').mockResolvedValue(undefined);

      const result = await handler.sendTokens(mockMessage);
      expect(result.text).toBe('Выберите сеть:');
    });

    it('should return error text if incorrect command', async () => {
      mockMessage.text = '/send invalid';
      jest.spyOn(mockRedisService, 'setHashFields').mockResolvedValue(undefined);

      const result = await handler.sendTokens(mockMessage);
      expect(result.text).toBe('Неверный формат команды');
    });
  });

  describe('sendNative', () => {
    it('should show keyboard of networks to choose', async () => {
      mockMessage.text = '/send 100 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
      jest.spyOn(mockRedisService, 'setHashFields').mockResolvedValue(undefined);

      const result = await handler.sendTokens(mockMessage);
      expect(result.text).toBe('Выберите сеть:');
    });
  });

  describe('fakeSwapTo', () => {
    it('should send fake transaction: wbnb -> token', async () => {
      mockMessage.text = '/faketo';
      jest.spyOn(mockRedisService, 'getTokens').mockResolvedValue([mockSessionToken]);
      jest.spyOn(mockBlockchainService, 'fakeSwapFrom').mockResolvedValue(undefined);

      const result = await handler['fakeSwapTo'](mockMessage);
      expect(result.text).toBe('Транзакция отправлена');
    });
  });

  describe('fakeSwapFrom', () => {
    it('should send fake transaction: token -> wbnb', async () => {
      mockMessage.text = '/fakefrom';
      jest.spyOn(mockRedisService, 'getTokens').mockResolvedValue([mockSessionToken]);
      jest.spyOn(mockBlockchainService, 'fakeSwapFrom').mockResolvedValue(undefined);

      const result = await handler['fakeSwapFrom'](mockMessage);
      expect(result.text).toBe('Транзакция отправлена');
    });
  });

  describe('help', () => {
    it('should return help message', async () => {
      mockMessage.text = '/help';
      const result = await handler.handleCommand(mockMessage);
      expect(result.text).toContain('Доступные команды:');
    });
  });
});
