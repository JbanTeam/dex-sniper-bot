import { Repository } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { BotError } from '@src/errors/BotError';
import { ReplicationService } from '../replication.service';
import { Replication } from '../replication.entity';
import { RedisService } from '@modules/redis/redis.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import {
  ChainsType,
  SessionReplication,
  SessionSubscription,
  SessionUser,
  SessionUserToken,
  SessionWallet,
  TempReplication,
} from '@src/types/types';
import { HttpStatus } from '@nestjs/common';

const mockSessionReplication = {
  id: 1,
  chatId: 123,
  userId: 1,
  tokenAddress: '0xTokenAddress',
  tokenDecimals: 9,
  tokenSymbol: 'Cake',
  subscriptionAddress: '0xSubAddress',
  tokenId: 1,
  subscriptionId: 1,
  network: 'BSC',
  buy: 100,
  sell: 200,
} as SessionReplication;

const mockReplication = {
  id: 1,
  buy: 100,
  sell: 100,
  network: 'BSC',
  subscription: { id: 1 },
  token: { id: 1 },
} as Replication;

const mockToken = {
  id: 1,
  name: 'PancakeSwap',
  symbol: 'Cake',
  address: '0xTokenAddress',
  network: 'BSC',
  decimals: 9,
} as SessionUserToken;

const moskSubscription = {
  id: 1,
  network: 'BSC',
  address: '0xSubAddress',
} as SessionSubscription;

const mockUserSession = {
  userId: 1,
  chatId: 123,
  wallets: [] as SessionWallet[],
  replications: [mockSessionReplication],
  tokens: [mockToken],
  subscriptions: [moskSubscription],
} as SessionUser;

describe('ReplicationService', () => {
  let replicationService: ReplicationService;
  let mockReplicationRepository: Partial<Repository<Replication>>;
  let mockRedisService: Partial<RedisService>;
  let mockConstantsProvider: Partial<ConstantsProvider>;

  beforeEach(async () => {
    mockReplicationRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    mockRedisService = {
      getUser: jest.fn().mockResolvedValue(mockUserSession),
      setUserField: jest.fn(),
    };

    mockConstantsProvider = {
      chains: {
        BSC: { exchange: 'PancakeSwap' },
      } as ChainsType,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReplicationService,
        {
          provide: getRepositoryToken(Replication),
          useValue: mockReplicationRepository,
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

    replicationService = module.get<ReplicationService>(ReplicationService);
  });

  describe('getReplications', () => {
    it('should return formatted replications list', async () => {
      mockRedisService.getReplications = jest.fn().mockResolvedValue([mockSessionReplication]);

      const result = await replicationService.getReplications(123);

      expect(result).toContain('<u>Ваши параметры повторов сделок:</u>');
      expect(result).toContain('<b>1. 💰 Кошелек:</b> <code>0xSubAddress</code>');
    });

    it('should throw error when no replications found', async () => {
      mockRedisService.getReplications = jest.fn().mockResolvedValue([]);

      await expect(replicationService.getReplications(123)).rejects.toThrow(
        new BotError('You have no replicatons', 'Вы не устанавливали повтор сделок', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('createOrUpdateReplication', () => {
    it('should update existing replication', async () => {
      const tempReplication: TempReplication = {
        action: 'buy',
        limit: 150,
        subscriptionId: 1,
        tokenId: 1,
        chatId: 123,
      };

      mockReplicationRepository.update = jest.fn().mockResolvedValue({ affected: 1 });

      const result = await replicationService.createOrUpdateReplication(tempReplication);

      expect(mockReplicationRepository.update).toHaveBeenCalledWith(mockSessionReplication.id, { buy: 150, sell: 200 });
      expect(result).toContain('<u>Кошелек:</u> <b>BSC</b> <code>0xSubAddress</code>');
    });

    it('should create a new replication if not exists', async () => {
      const tempReplication: TempReplication = {
        action: 'sell',
        limit: 250,
        subscriptionId: 1,
        tokenId: 1,
        chatId: 123,
        userId: 1,
      };

      mockReplicationRepository.create = jest.fn().mockReturnValue(mockReplication);
      mockReplicationRepository.save = jest.fn().mockResolvedValue(mockReplication);
      mockReplicationRepository.findOne = jest.fn().mockResolvedValue(mockReplication);

      mockUserSession.replications = [];

      const result = await replicationService.createOrUpdateReplication(tempReplication);

      expect(mockReplicationRepository.create).toHaveBeenCalled();
      expect(mockReplicationRepository.save).toHaveBeenCalled();
      expect(result).toContain('<u>Кошелек:</u> <b>BSC</b> <code>0xSubAddress</code>');
    });

    it('should throw error for invalid data', async () => {
      const tempReplication: TempReplication = {
        action: 'buy',
        limit: 150,
        subscriptionId: 1,
        tokenId: 1,
      };

      await expect(replicationService.createOrUpdateReplication(tempReplication)).rejects.toThrow(
        new BotError('Invalid data in tempReplication', 'Не удалось установить повтор сделок', HttpStatus.BAD_REQUEST),
      );
    });
  });
});
