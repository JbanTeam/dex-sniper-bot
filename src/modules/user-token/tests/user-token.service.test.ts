import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';

import { UserTokenService } from '../user-token.service';
import { UserToken } from '../user-token.entity';
import { User } from '@modules/user/user.entity';
import { RedisService } from '@modules/redis/redis.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { BotError } from '@src/errors/BotError';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChainsType, SessionUser, SessionUserToken } from '@src/types/types';
import { HttpStatus } from '@nestjs/common';

const mockUserToken = {
  id: 1,
  address: '0xTokenAddress',
  network: 'BSC',
  name: 'Test Token',
  symbol: 'TT',
  decimals: 18,
  user: { id: 1 } as User,
  replications: [],
} as UserToken;

const mockSessionToken: SessionUserToken = {
  ...mockUserToken,
};

const mockUserSession = {
  userId: 1,
  chatId: 123,
  tokens: [],
  wallets: [],
  subscriptions: [],
  replications: [],
} as SessionUser;

describe('UserTokenService', () => {
  let userTokenService: UserTokenService;
  let mockUserTokenRepository: Partial<Repository<UserToken>>;
  let mockRedisService: Partial<RedisService>;
  let mockBlockchainService: Partial<BlockchainService>;
  let mockConstantsProvider: Partial<ConstantsProvider>;
  let mockEventEmitter: Partial<EventEmitter2>;

  beforeEach(async () => {
    mockUserTokenRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
    };

    mockRedisService = {
      getUser: jest.fn(),
      addToken: jest.fn(),
      removeToken: jest.fn(),
      existsInSet: jest.fn(),
      getHashFeilds: jest.fn(),
      findTestTokenById: jest.fn(),
      addPair: jest.fn(),
    };

    mockBlockchainService = {
      checkToken: jest.fn(),
      createTestToken: jest.fn(),
    };

    mockConstantsProvider = {
      chains: {
        BSC: { exchange: 'PancakeSwap' },
      } as ChainsType,
      notProd: false,
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserTokenService,
        {
          provide: getRepositoryToken(UserToken),
          useValue: mockUserTokenRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: BlockchainService,
          useValue: mockBlockchainService,
        },
        {
          provide: ConstantsProvider,
          useValue: mockConstantsProvider,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    userTokenService = module.get<UserTokenService>(UserTokenService);
  });

  describe('addToken', () => {
    it('should add token with provided params', async () => {
      mockRedisService.getUser = jest.fn().mockResolvedValue(mockUserSession);
      mockBlockchainService.checkToken = jest.fn().mockResolvedValue({
        name: 'Test Token',
        symbol: 'TT',
        decimals: 18,
        existsTokenId: '',
        pairAddresses: null,
      });
      mockUserTokenRepository.create = jest.fn().mockReturnValue(mockUserToken);
      mockUserTokenRepository.save = jest.fn().mockResolvedValue(mockUserToken);

      const result = await userTokenService.addToken({
        userSession: mockUserSession,
        address: '0xTokenAddress',
        network: 'BSC',
      });

      expect(result).toContain('Ваши токены:');
      expect(result).toContain('Test Token (TT)');
      expect(mockUserTokenRepository.save).toHaveBeenCalled();
    });

    it('should throw error when token already exists', async () => {
      mockUserSession.tokens = [mockSessionToken];

      await expect(
        userTokenService.addToken({
          userSession: mockUserSession,
          address: '0xTokenAddress',
          network: 'BSC',
        }),
      ).rejects.toThrow(new BotError('Token already added', 'Токен уже добавлен', HttpStatus.BAD_REQUEST));
    });

    it('should throw error when max tokens per network reached', async () => {
      mockUserSession.tokens = Array(5).fill({
        ...mockSessionToken,
        address: `0x${Math.random().toString(16)}`,
      }) as SessionUserToken[];

      await expect(
        userTokenService.addToken({
          userSession: mockUserSession,
          address: '0xTokenAddress',
          network: 'BSC',
        }),
      ).rejects.toThrow(
        new BotError(
          'You can add only 5 tokens per network',
          'Максимум можно добавить 5 токенов на одну сеть',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  describe('getTokens', () => {
    it('should return formatted tokens list', async () => {
      const chatId = 123;
      mockUserSession.tokens = [mockSessionToken];

      mockRedisService.getUser = jest.fn().mockResolvedValue(mockUserSession);

      const result = await userTokenService.getTokens(chatId);

      expect(result).toContain('Ваши токены:');
      expect(result).toContain('Test Token (TT)');
    });

    it('should throw error when no tokens found', async () => {
      const chatId = 123;
      const mockUserSession = {
        tokens: [],
      };

      mockRedisService.getUser = jest.fn().mockResolvedValue(mockUserSession);

      await expect(userTokenService.getTokens(chatId)).rejects.toThrow(
        new BotError('You have no saved tokens', 'У вас нет сохраненных токенов', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('removeToken', () => {
    it('should remove token by address', async () => {
      const chatId = 123;
      const mockUserSession = {
        userId: 1,
        tokens: [mockSessionToken],
      };

      mockRedisService.getUser = jest.fn().mockResolvedValue(mockUserSession);
      mockUserTokenRepository.delete = jest.fn().mockResolvedValue({ affected: 1 });

      await userTokenService.removeToken({
        chatId,
        address: '0xTokenAddress',
      });

      expect(mockUserTokenRepository.delete).toHaveBeenCalledWith({
        user: { id: mockUserSession.userId },
        address: '0xTokenAddress',
      });
      expect(mockRedisService.removeToken).toHaveBeenCalled();
    });

    it('should remove tokens by network', async () => {
      const chatId = 123;
      const mockUserSession = {
        userId: 1,
        tokens: [mockSessionToken],
      };

      mockRedisService.getUser = jest.fn().mockResolvedValue(mockUserSession);
      mockUserTokenRepository.delete = jest.fn().mockResolvedValue({ affected: 1 });

      await userTokenService.removeToken({
        chatId,
        network: 'BSC',
      });

      expect(mockUserTokenRepository.delete).toHaveBeenCalledWith({
        user: { id: mockUserSession.userId },
        network: 'BSC',
      });
      expect(mockRedisService.removeToken).toHaveBeenCalled();
    });

    it('should throw error when no tokens found', async () => {
      const chatId = 123;
      const mockUserSession = {
        tokens: [],
      };

      mockRedisService.getUser = jest.fn().mockResolvedValue(mockUserSession);

      await expect(
        userTokenService.removeToken({
          chatId,
          address: '0xTokenAddress',
        }),
      ).rejects.toThrow(
        new BotError('You have no saved tokens', 'У вас нет сохраненных токенов', HttpStatus.NOT_FOUND),
      );
    });

    it('should throw error when token not found by address', async () => {
      const chatId = 123;
      const mockUserSession = {
        tokens: [{ ...mockSessionToken, address: '0xTokenAddress2' }],
      };

      mockRedisService.getUser = jest.fn().mockResolvedValue(mockUserSession);

      await expect(
        userTokenService.removeToken({
          chatId,
          address: '0xTokenAddress',
        }),
      ).rejects.toThrow(new BotError('Token not found', 'Токен не найден', HttpStatus.NOT_FOUND));
    });

    it('should throw error when tokens not found in network', async () => {
      const chatId = 123;
      const mockUserSession = {
        tokens: [{ ...mockSessionToken, network: 'ETH' }],
      };

      mockRedisService.getUser = jest.fn().mockResolvedValue(mockUserSession);

      await expect(
        userTokenService.removeToken({
          chatId,
          network: 'BSC',
        }),
      ).rejects.toThrow(
        new BotError('Tokens not found in this network', 'Токены не найдены в указанной сети', HttpStatus.NOT_FOUND),
      );
    });

    it('should throw error when tokens not deleted', async () => {
      const chatId = 123;
      const mockUserSession = {
        userId: 1,
        tokens: [mockSessionToken],
      };

      mockRedisService.getUser = jest.fn().mockResolvedValue(mockUserSession);
      mockUserTokenRepository.delete = jest.fn().mockResolvedValue({ affected: 0 });

      await expect(
        userTokenService.removeToken({
          chatId,
          address: '0xTokenAddress',
        }),
      ).rejects.toThrow(new BotError('Tokens not deleted', 'Токены не удалены', HttpStatus.BAD_REQUEST));
    });
  });
});
