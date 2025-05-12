import { Repository } from 'typeorm';
import { createMock } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';

import { WalletService } from '../wallet.service';
import { Wallet } from '../wallet.entity';
import { CreateWalletParams } from '../types';
import { RedisService } from '@modules/redis/redis.service';
import { Network } from '@src/types/types';
import { User } from '@modules/user/user.entity';

const mockWallet = {
  network: Network.BSC,
  encryptedPrivateKey: 'encryptedKey',
  address: '0x123',
  id: 1,
  user: { id: 1 } as User,
} as Wallet;

describe('WalletService', () => {
  let mockWalletService: WalletService;
  let mockWalletRepository: Repository<Wallet>;
  let mockRedisRervice: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: createMock<Repository<Wallet>>(),
        },
        {
          provide: RedisService,
          useValue: {
            getUser: jest.fn(),
          },
        },
      ],
    }).compile();

    mockWalletService = module.get<WalletService>(WalletService);
    mockRedisRervice = module.get<RedisService>(RedisService);
    mockWalletRepository = module.get<Repository<Wallet>>(getRepositoryToken(Wallet));
  });

  describe('createWallet', () => {
    it('should create wallet with provided params', async () => {
      const params: CreateWalletParams = {
        network: Network.BSC,
        encryptedPrivateKey: 'encryptedKey',
        address: '0xWalletAddress',
        userId: 1,
      };

      mockWalletRepository.manager.create = jest.fn().mockReturnValue(mockWallet);
      mockWalletRepository.manager.save = jest.fn().mockResolvedValue(mockWallet);

      const result = await mockWalletService.createWallet(params);

      expect(jest.spyOn(mockWalletRepository.manager, 'create')).toHaveBeenCalledWith(Wallet, {
        network: params.network,
        encryptedPrivateKey: params.encryptedPrivateKey,
        address: params.address,
        user: { id: params.userId },
      });
      expect(jest.spyOn(mockWalletRepository.manager, 'save')).toHaveBeenCalledWith(mockWallet);
      expect(result).toBe(mockWallet);
    });
  });

  describe('getWallets', () => {
    it('should return formatted wallets list', async () => {
      const chatId = 123;
      const mockUserSession = {
        wallets: [
          { network: 'BSC', address: '0xBscWalletAddress' },
          { network: 'POLYGON', address: '0xPolygonWalletAddress' },
        ],
      };

      mockRedisRervice.getUser = jest.fn().mockResolvedValue(mockUserSession);

      const result = await mockWalletService.getWallets(chatId);

      expect(result).toContain('<u>Ваши кошельки:</u>');
      expect(result).toContain('1. <b>BSC:</b>');
      expect(result).toContain('<code>0xBscWalletAddress</code>');
      expect(result).toContain('2. <b>POLYGON:</b>');
      expect(result).toContain('<code>0xPolygonWalletAddress</code>');
    });

    it('should throw error when no wallets found', async () => {
      const chatId = 123;
      const mockUserSession = { wallets: [] };

      mockRedisRervice.getUser = jest.fn().mockResolvedValue(mockUserSession);

      await expect(mockWalletService.getWallets(chatId)).rejects.toThrow(new Error('You have no wallets'));
    });
  });

  describe('findByAddress', () => {
    it('should return wallet by address', async () => {
      const address = '0xWalletAddress';

      mockWalletRepository.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await mockWalletService.findByAddress(address);

      expect(jest.spyOn(mockWalletRepository, 'findOne')).toHaveBeenCalledWith({
        where: { address },
      });
      expect(result).toBe(mockWallet);
    });

    it('should return null when wallet not found', async () => {
      const address = '0xWalletAddress  ';

      mockWalletRepository.findOne = jest.fn().mockResolvedValue(null);

      const result = await mockWalletService.findByAddress(address);

      expect(result).toBeNull();
    });
  });
});
