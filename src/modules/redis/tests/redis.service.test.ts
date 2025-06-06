import Redis, { ChainableCommander } from 'ioredis';
import { Test, TestingModule } from '@nestjs/testing';

import { BotError } from '@libs/core/errors';
import { RedisService } from '../redis.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { SessionUser, Address } from '@src/types/types';
import { AddTokenParams, SubscriptionParams, AddPairParams, RemoveTokenParams, GetPairParams } from '../types';
import { HttpStatus } from '@nestjs/common';

const mockConstantsProvider = {
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  REDIS_PASSWORD: 'password',
  REDIS_USERNAME: 'user',
  REDIS_DB: '0',
  notProd: true,
};

const mockSessionUser: SessionUser = {
  userId: 1,
  chatId: 123,
  tokens: [],
  testTokens: [],
  wallets: [],
  subscriptions: [],
  replications: [],
};

const mockAddTokenParams: AddTokenParams = {
  chatId: 123,
  token: { id: 1, address: '0xTokenAddress', network: 'BSC', name: 'Token', symbol: 'TKN', decimals: 18 },
  tokens: [],
  prefix: 'token',
};

const mockSubscriptionParams: SubscriptionParams = {
  chatId: 123,
  subscription: { address: '0xSubscriptionAddress', network: 'BSC', id: 1 },
  subscriptions: [],
};

const pipelineMock = {
  set: jest.fn().mockReturnThis(),
  del: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  hset: jest.fn().mockReturnThis(),
  hmset: jest.fn().mockReturnThis(),
  hmget: jest.fn().mockReturnThis(),
  hgetall: jest.fn().mockReturnThis(),
  sadd: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([]),
};

jest.mock('ioredis', () => {
  const actual = jest.requireActual('ioredis') as unknown as object;
  return {
    ...actual,
    hgetall: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    hset: jest.fn(),
    hmset: jest.fn(),
    expire: jest.fn(),
    sadd: jest.fn(),
    scan: jest.fn(),
    scard: jest.fn(),
    sismember: jest.fn(),
    pipeline: jest.fn().mockImplementation(() => pipelineMock),
  } as unknown;
});

describe('RedisService', () => {
  let redisService: RedisService;
  let redisClient: jest.Mocked<Redis>;

  afterEach(async () => {
    await redisService['redisClient'].quit();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisService, { provide: ConstantsProvider, useValue: mockConstantsProvider }],
    }).compile();

    redisService = module.get<RedisService>(RedisService);
    redisClient = redisService['redisClient'] as jest.Mocked<Redis>;

    jest.spyOn(redisClient, 'hset').mockResolvedValue(1);
    jest.spyOn(redisClient, 'hmset').mockResolvedValue('OK');
    jest.spyOn(redisClient, 'expire').mockResolvedValue(1);
    jest.spyOn(redisClient, 'sadd').mockResolvedValue(1);
    jest.spyOn(redisClient, 'scan').mockResolvedValue(['0', []]);
    jest.spyOn(redisClient, 'hgetall').mockResolvedValue({ field1: 'value1' });
    jest.spyOn(redisClient, 'pipeline').mockReturnValue(pipelineMock as unknown as ChainableCommander);
  });

  it('should add a user', async () => {
    await redisService.addUser(mockSessionUser);
    expect(jest.spyOn(redisClient, 'hset')).toHaveBeenCalled();
    expect(jest.spyOn(redisClient, 'expire')).toHaveBeenCalledWith('user:123', 3600 * 24 * 30);
    expect(jest.spyOn(redisClient, 'sadd')).toHaveBeenCalledWith('users', 123);
  });

  it('should add a token', async () => {
    jest.spyOn(redisService, 'existsInSet').mockResolvedValue(0);
    pipelineMock.exec.mockResolvedValue([]);

    await redisService.addToken(mockAddTokenParams);
    expect(jest.spyOn(redisClient, 'pipeline')).toHaveBeenCalled();
    expect(pipelineMock.hset).toHaveBeenCalled();
    expect(pipelineMock.hmset).toHaveBeenCalled();
    expect(pipelineMock.exec).toHaveBeenCalled();
  });

  it('should add a subscription', async () => {
    await redisService.addSubscription(mockSubscriptionParams);
    expect(jest.spyOn(redisClient, 'pipeline')).toHaveBeenCalled();
    expect(pipelineMock.hset).toHaveBeenCalled();
    expect(pipelineMock.sadd).toHaveBeenCalled();
    expect(pipelineMock.hmset).toHaveBeenCalled();
    expect(pipelineMock.exec).toHaveBeenCalled();
  });

  it('should add a pair', async () => {
    const mockAddPairParams: AddPairParams = {
      network: 'BSC',
      pairAddress: '0xPairAddress',
      token0: '0xToken0Address',
      token1: '0xToken1Address',
      prefix: 'pair',
    };
    await redisService.addPair(mockAddPairParams);
    expect(jest.spyOn(redisClient, 'pipeline')).toHaveBeenCalled();
    expect(pipelineMock.hset).toHaveBeenCalled();
    expect(pipelineMock.sadd).toHaveBeenCalled();
    expect(pipelineMock.exec).toHaveBeenCalled();
  });

  it('should remove a token', async () => {
    const mockRemoveTokenParams: RemoveTokenParams = {
      userSession: mockSessionUser,
      deleteConditions: { user: { id: 1 }, address: '0xTokenAddress', network: 'BSC' },
    };
    (redisService as any).filterTokens = jest.fn().mockReturnValue({
      remainingTokens: { tokens: [], testTokens: [] },
      replications: [],
      deletedTokens: [],
      deletedTestTokens: [],
    });
    (redisService as any).deleteTokens = jest.fn();
    (redisService as any).cleanTokenSets = jest.fn();
    await redisService.removeToken(mockRemoveTokenParams);
    expect(jest.spyOn(redisClient, 'pipeline')).toHaveBeenCalled();
    expect((redisService as any).filterTokens).toHaveBeenCalledWith(mockRemoveTokenParams);
    expect((redisService as any).deleteTokens).toHaveBeenCalled();
    expect((redisService as any).cleanTokenSets).toHaveBeenCalled();
  });

  it('should remove a subscription', async () => {
    const mockRemoveSubscriptionParams: SubscriptionParams = {
      chatId: 123,
      subscription: { address: '0xSubscriptionAddress', network: 'BSC', id: 1 },
      subscriptions: [mockSubscriptionParams.subscription],
      replications: [],
    };

    jest.spyOn(redisService, 'hasKeysWithPattern').mockResolvedValue(true);

    await redisService.removeSubscription(mockRemoveSubscriptionParams);
    expect(jest.spyOn(redisClient, 'pipeline')).toHaveBeenCalled();
    expect(pipelineMock.hset).toHaveBeenCalled();
    expect(pipelineMock.del).toHaveBeenCalled();
    expect(pipelineMock.exec).toHaveBeenCalled();
  });

  it('should set a user field', async () => {
    await redisService.setUserField(123, 'key', 'value');
    expect(jest.spyOn(redisClient, 'hset')).toHaveBeenCalledWith('user:123', 'key', 'value');
  });

  it('should check if value exists in set', async () => {
    redisClient.sismember = jest.fn().mockResolvedValue(1);
    const result = await redisService.existsInSet('setName', 'value');
    expect(jest.spyOn(redisClient, 'sismember')).toHaveBeenCalledWith('setName', 'value');
    expect(result).toBe(1);
  });

  it('should check if set is empty', async () => {
    redisClient.scard = jest.fn().mockResolvedValue(0);
    const result = await redisService.isSetEmpty('key');
    expect(jest.spyOn(redisClient, 'scard')).toHaveBeenCalledWith('key');
    expect(result).toBe(true);
  });

  it('should get a user', async () => {
    redisClient.hgetall = jest.fn().mockResolvedValue({ chatId: '123', userId: '1' });
    const result = await redisService.getUser(123);
    expect(jest.spyOn(redisClient, 'hgetall')).toHaveBeenCalledWith('user:123');
    expect(result).toEqual({ chatId: 123, userId: 1 });
  });

  it('should throw error if user not found in getUser', async () => {
    redisClient.hgetall = jest.fn().mockResolvedValue(null as unknown as Record<string, string>);
    await expect(redisService.getUser(123)).rejects.toThrow(
      new BotError('User not found', 'Пользователь не найден', HttpStatus.NOT_FOUND),
    );
  });

  it('should get hash fields', async () => {
    const result = await redisService.getHashFeilds('key');
    expect(jest.spyOn(redisClient, 'hgetall')).toHaveBeenCalledWith('key');
    expect(result).toEqual({ field1: 'value1' });
  });

  it('should set hash fields', async () => {
    await redisService.setHashFeilds('key', { field1: 'value1' });
    expect(jest.spyOn(redisClient, 'hmset')).toHaveBeenCalledWith('key', { field1: 'value1' });
    expect(jest.spyOn(redisClient, 'expire')).not.toHaveBeenCalled();
  });

  it('should set hash fields with expiration', async () => {
    await redisService.setHashFeilds('key', { field1: 'value1' }, 3600);
    expect(jest.spyOn(redisClient, 'hmset')).toHaveBeenCalledWith('key', { field1: 'value1' });
    expect(jest.spyOn(redisClient, 'expire')).toHaveBeenCalledWith('key', 3600);
  });

  it('should get temp wallet', async () => {
    redisClient.hget = jest.fn().mockResolvedValue('tempWalletValue');
    const result = await redisService.getTempWallet(123);
    expect(jest.spyOn(redisClient, 'hget')).toHaveBeenCalledWith('user:123', 'tempWallet');
    expect(result).toBe('tempWalletValue');
  });

  it('should get temp replication', async () => {
    const mockTempReplication = { action: 'buy', limit: 100 };
    redisClient.hget = jest.fn().mockResolvedValue(JSON.stringify(mockTempReplication));
    const result = await redisService.getTempReplication(123);
    expect(jest.spyOn(redisClient, 'hget')).toHaveBeenCalledWith('user:123', 'tempReplication');
    expect(result).toEqual(mockTempReplication);
  });

  it('should throw error if temp replication not found', async () => {
    redisClient.hget = jest.fn().mockResolvedValue(null);
    await expect(redisService.getTempReplication(123)).rejects.toThrow(
      new BotError('Error getting temp replication', 'Ошибка установления повтора сделок', HttpStatus.NOT_FOUND),
    );
  });

  it('should get temp send tokens', async () => {
    redisClient.hget = jest.fn().mockResolvedValue('tempSendTokensValue');
    const result = await redisService.getTempSendTokens(123);
    expect(jest.spyOn(redisClient, 'hget')).toHaveBeenCalledWith('user:123', 'tempSendTokens');
    expect(result).toBe('tempSendTokensValue');
  });

  it('should get wallets', async () => {
    const mockWallets = [{ address: '0xWallet1' }];
    redisClient.hget = jest.fn().mockResolvedValue(JSON.stringify(mockWallets));
    const result = await redisService.getWallets(123);
    expect(jest.spyOn(redisClient, 'hget')).toHaveBeenCalledWith('user:123', 'wallets');
    expect(result).toEqual(mockWallets);
  });

  it('should return null if no wallets found', async () => {
    redisClient.hget = jest.fn().mockResolvedValue(null);
    const result = await redisService.getWallets(123);
    expect(result).toBeNull();
  });

  it('should get tokens', async () => {
    const mockTokens = [{ address: '0xToken1' }];
    redisClient.hget = jest.fn().mockResolvedValue(JSON.stringify(mockTokens));
    const result = await redisService.getTokens(123, 'tokens');
    expect(jest.spyOn(redisClient, 'hget')).toHaveBeenCalledWith('user:123', 'tokens');
    expect(result).toEqual(mockTokens);
  });

  it('should return null if no tokens found for prefix', async () => {
    redisClient.hget = jest.fn().mockResolvedValue(null);
    const result = await redisService.getTokens(123, 'tokens');
    expect(result).toBeNull();
  });

  it('should get a specific token', async () => {
    const mockTokenData = { address: '0xTokenAddress', name: 'Test Token' };
    redisClient.hgetall = jest.fn().mockResolvedValue(mockTokenData);
    const result = await redisService.getToken('0xTokenAddress' as Address, 'token');
    expect(jest.spyOn(redisClient, 'hgetall')).toHaveBeenCalledWith('token:0xTokenAddress');
    expect(result).toEqual(mockTokenData);
  });

  it('should return null if specific token not found', async () => {
    redisClient.hgetall = jest.fn().mockResolvedValue(null);
    const result = await redisService.getToken('0xTokenAddress' as Address, 'token');
    expect(result).toBeNull();
  });

  it('should get a pair', async () => {
    const tokenAddr = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';
    redisClient.hget = jest.fn().mockResolvedValue(`${tokenAddr}:${tokenAddr}`);
    const mockGetPairParams: GetPairParams = {
      pairAddress: '0xPairAddress' as Address,
      network: 'BSC',
      prefix: 'pair',
    };
    const result = await redisService.getPair(mockGetPairParams);
    expect(jest.spyOn(redisClient, 'hget')).toHaveBeenCalledWith('pair:BSC', '0xpairaddress');
    expect(result).toEqual({ token0: tokenAddr, token1: tokenAddr });
  });

  it('should return null if pair not found', async () => {
    redisClient.hget = jest.fn().mockResolvedValue(null);
    const mockGetPairParams: GetPairParams = {
      pairAddress: '0xPairAddress' as Address,
      network: 'BSC',
      prefix: 'pair',
    };
    const result = await redisService.getPair(mockGetPairParams);
    expect(result).toBeNull();
  });

  it('should get tx context', async () => {
    const mockTxContext = { from: '0xFrom', to: '0xTo' };
    redisClient.hgetall = jest.fn().mockResolvedValue(mockTxContext);
    const result = await redisService.getTxContext('txKey');
    expect(jest.spyOn(redisClient, 'hgetall')).toHaveBeenCalledWith('txKey');
    expect(result).toEqual(mockTxContext);
  });

  it('should return null if tx context not found', async () => {
    redisClient.hgetall = jest.fn().mockResolvedValue(null);
    const result = await redisService.getTxContext('txKey');
    expect(result).toBeNull();
  });

  it('should get subscriptions', async () => {
    const mockSubs = [{ address: '0xSub1' }];
    redisClient.hget = jest.fn().mockResolvedValue(JSON.stringify(mockSubs));
    const result = await redisService.getSubscriptions(123);
    expect(jest.spyOn(redisClient, 'hget')).toHaveBeenCalledWith('user:123', 'subscriptions');
    expect(result).toEqual(mockSubs);
  });

  it('should return null if no subscriptions found for user', async () => {
    redisClient.hget = jest.fn().mockResolvedValue(null);
    const result = await redisService.getSubscriptions(123);
    expect(result).toBeNull();
  });

  it('should get replications', async () => {
    const mockReps = [{ id: 1 }];
    redisClient.hget = jest.fn().mockResolvedValue(JSON.stringify(mockReps));
    const result = await redisService.getReplications(123);
    expect(jest.spyOn(redisClient, 'hget')).toHaveBeenCalledWith('user:123', 'replications');
    expect(result).toEqual(mockReps);
  });

  it('should return null if no replications found for user', async () => {
    redisClient.hget = jest.fn().mockResolvedValue(null);
    const result = await redisService.getReplications(123);
    expect(result).toBeNull();
  });

  it('should get cached contracts', async () => {
    const mockCachedData = { contract1: 'address1' };
    redisClient.hgetall = jest.fn().mockResolvedValue(mockCachedData);
    const result = await redisService.getCachedContracts();
    expect(jest.spyOn(redisClient, 'hgetall')).toHaveBeenCalledWith('cachedContracts');
    expect(result).toEqual(mockCachedData);
  });

  it('should return empty object if no cached contracts found', async () => {
    redisClient.hgetall = jest.fn().mockResolvedValue(null);
    const result = await redisService.getCachedContracts();
    expect(result).toEqual({});
  });

  it('should get all users', async () => {
    redisClient.smembers = jest.fn().mockResolvedValue(['123', '456']);
    redisClient.hgetall
      .mockResolvedValueOnce({ chatId: '123', userId: '1' })
      .mockResolvedValueOnce({ chatId: '456', userId: '2' });
    const result = await redisService.getAllUsers();
    expect(jest.spyOn(redisClient, 'smembers')).toHaveBeenCalledWith('users');
    expect(jest.spyOn(redisClient, 'hgetall')).toHaveBeenCalledWith('user:123');
    expect(jest.spyOn(redisClient, 'hgetall')).toHaveBeenCalledWith('user:456');
    expect(result).toEqual([
      { chatId: 123, userId: 1 },
      { chatId: 456, userId: 2 },
    ]);
  });

  it('should get users set', async () => {
    redisClient.smembers = jest.fn().mockResolvedValue(['123', '456']);
    const result = await redisService.getUsersSet();
    expect(jest.spyOn(redisClient, 'smembers')).toHaveBeenCalledWith('users');
    expect(result).toEqual(['123', '456']);
  });

  it('should get tokens set', async () => {
    redisClient.smembers = jest.fn().mockResolvedValue(['token1', 'token2']);
    const result = await redisService.getTokensSet('BSC', 'tokens');
    expect(jest.spyOn(redisClient, 'smembers')).toHaveBeenCalledWith('tokens:BSC');
    expect(result).toEqual(['token1', 'token2']);
  });

  it('should get pairs set', async () => {
    redisClient.smembers = jest.fn().mockResolvedValue(['pair1', 'pair2']);
    const result = await redisService.getPairsSet('BSC', 'pairs');
    expect(jest.spyOn(redisClient, 'smembers')).toHaveBeenCalledWith('pairs:BSC');
    expect(result).toEqual(['pair1', 'pair2']);
  });

  it('should get subscriptions set', async () => {
    redisClient.smembers = jest.fn().mockResolvedValue(['sub1', 'sub2']);
    const result = await redisService.getSubscriptionsSet('BSC');
    expect(jest.spyOn(redisClient, 'smembers')).toHaveBeenCalledWith('subscriptions:BSC');
    expect(result).toEqual(['sub1', 'sub2']);
  });

  it('should find test token by id', async () => {
    const mockTokenData = { id: 1, address: '0xTestToken', name: 'Test Token' };
    redisClient.scan = jest
      .fn()
      .mockResolvedValueOnce(['10', ['testToken:0xTestToken:123']])
      .mockResolvedValueOnce(['0', []]);
    redisClient.hget = jest.fn().mockResolvedValue('1');
    redisClient.hgetall = jest.fn().mockResolvedValue(mockTokenData);
    const result = await redisService.findTestTokenById('1');
    expect(jest.spyOn(redisClient, 'scan')).toHaveBeenCalledWith('0', 'MATCH', 'testToken:*', 'COUNT', 10);
    expect(jest.spyOn(redisClient, 'hget')).toHaveBeenCalledWith('testToken:0xTestToken:123', 'id');
    expect(jest.spyOn(redisClient, 'hgetall')).toHaveBeenCalledWith('testToken:0xTestToken:123');
    expect(result).toEqual(mockTokenData);
  });

  it('should return null if test token not found by id', async () => {
    redisClient.scan = jest.fn().mockResolvedValue(['0', []]);
    const result = await redisService.findTestTokenById('1');
    expect(result).toBeNull();
  });

  it('should check if keys with pattern exist', async () => {
    redisClient.scan = jest.fn().mockResolvedValue(['0', ['key1']]);
    const result = await redisService.hasKeysWithPattern('key*');
    expect(jest.spyOn(redisClient, 'scan')).toHaveBeenCalledWith('0', 'MATCH', 'key*', 'COUNT', 100);
    expect(result).toBe(true);
  });

  it('should return false if no keys with pattern exist', async () => {
    redisClient.scan = jest.fn().mockResolvedValue(['0', []]);
    const result = await redisService.hasKeysWithPattern('key*');
    expect(result).toBe(false);
  });
});
