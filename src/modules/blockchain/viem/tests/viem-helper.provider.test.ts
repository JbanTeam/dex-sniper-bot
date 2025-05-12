import { EventEmitter2 } from '@nestjs/event-emitter';
import { bsc, polygon } from 'viem/chains';
import { Test, TestingModule } from '@nestjs/testing';
import { createPublicClient, createWalletClient, Log, PublicClient, WalletClient } from 'viem';

import { ViemHelperProvider } from '../viem-helper.provider';
import { AnvilProvider } from '../anvil/anvil.provider';
import { ViemClientsType } from '../types';
import { RedisService } from '@modules/redis/redis.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { BalanceInfo, Transaction } from '@modules/blockchain/types';
import { Address, Network, ViemNetwork } from '@src/types/types';

const mockNetwork: Network = 'BSC';

const mockRedisService = {
  getCachedContracts: jest.fn(),
  getPair: jest.fn(),
};

const mockAnvilProvider = {
  createClients: jest.fn(),
  initTestAddresses: jest.fn(),
  initTestDex: jest.fn(),
};

const mockConstantsProvider = {
  chains: {
    BSC: {
      rpcUrl: 'https://bsc-dataseed.binance.org/',
      rpcWsUrl: 'https://bsc-dataseed.binance.org/',
      chain: bsc,
      nativeToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      tokenName: 'BNB',
      tokenSymbol: 'BNB',
      tokenDecimals: 18,
      exchange: 'PancakeSwap',
      routerAddress: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
      factoryAddress: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
    },
    POLYGON: {
      name: 'Polygon',
      rpcUrl: 'https://polygon-rpc.com/',
      rpcWsUrl: 'https://polygon-rpc.com/',
      chain: polygon,
      nativeToken: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      tokenName: 'POL',
      tokenSymbol: 'POL',
      tokenDecimals: 18,
      exchange: 'Uniswap',
      routerAddress: '0xedf6066a2b290C185783862C7F4776A2C8077AD1',
      factoryAddress: '0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C',
    },
  },
  notProd: true,
  ANVIL_RPC_URL: 'http://localhost:8545',
};

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
  getTransaction: jest.fn(),
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

const mockPairAddresses = { pairAddress: '0xPairAddress', token0: '0xT0', token1: '0xT1' };

const mockEventEmitter = {
  emit: jest.fn(),
};

jest.mock('viem', () => {
  const actual = jest.requireActual('viem') as unknown as object;
  return {
    ...actual,
    createPublicClient: jest.fn(),
    createWalletClient: jest.fn(),
  } as unknown;
});

describe('ViemHelperProvider', () => {
  let viemHelperProvider: ViemHelperProvider;

  beforeEach(async () => {
    jest.clearAllMocks();

    (createWalletClient as jest.Mock).mockReturnValue(mockWalletClient);
    (createPublicClient as jest.Mock).mockReturnValue(mockPublicClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ViemHelperProvider,
        { provide: RedisService, useValue: mockRedisService },
        { provide: AnvilProvider, useValue: mockAnvilProvider },
        { provide: ConstantsProvider, useValue: mockConstantsProvider },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    viemHelperProvider = module.get<ViemHelperProvider>(ViemHelperProvider);
    viemHelperProvider['clients'] = mockClients;
    viemHelperProvider['cachedContracts'].nativeToken = '0xNativeToken';
    viemHelperProvider['cachedContracts'].routerAddress = '0xRouterAddress';
    viemHelperProvider['cachedContracts'].factoryAddress = '0xFactoryAddress';
    mockRedisService.getPair.mockResolvedValue(mockPairAddresses);
  });

  describe('createClients', () => {
    it('should create clients for each network', () => {
      const clients = viemHelperProvider.createClients();
      expect(clients.public[mockNetwork]).toBeDefined();
      expect(clients.publicWebsocket[mockNetwork]).toBeDefined();
    });
  });

  describe('getClients', () => {
    it('should return the clients', () => {
      const clients = viemHelperProvider.getClients();
      expect(clients).toBeDefined();
    });
  });

  describe('initUnwatchCallbacks', () => {
    it('should initialize unwatch callbacks for each network', () => {
      const unwatchCallbacks = viemHelperProvider.initUnwatchCallbacks();
      expect(unwatchCallbacks[mockNetwork]).toBeDefined();
    });
  });

  describe('initAnvil', () => {
    it('should initialize Anvil test addresses and dex', async () => {
      await viemHelperProvider.initAnvil();
      expect(mockAnvilProvider.initTestAddresses).toHaveBeenCalled();
      expect(mockAnvilProvider.initTestDex).toHaveBeenCalled();
    });
  });

  describe('initSwapArgs', () => {
    it('should initialize swap arguments', async () => {
      const tx: Transaction = {
        eventName: 'Swap',
        pairAddress: '0xPairAddress' as Address,
        routerAddress: '0xRouterAddress' as Address,
        sender: '0xSenderAddress' as Address,
        to: '0xToAddress' as Address,
        userAddress: '0xUserAddress' as Address,
        amountIn: 1000n,
        amountOut: 900n,
        tokenIn: '0xNativeToken',
        tokenOut: '0xTokenAddress',
        network: 'BSC',
        hash: '0xHash' as Address,
        initiators: [],
        replicationDepth: 0,
        data: 'data',
      };

      jest.spyOn(mockPublicClient, 'readContract').mockResolvedValue([1000n, 1000n]);
      jest.spyOn(viemHelperProvider, 'getSharedVars').mockReturnValue({
        nativeToken: '0xNativeToken',
        chain: bsc,
        routerAddress: '0xRouterAddress',
        rpcUrl: 'https://bsc-dataseed.binance.org/',
      });

      const walletAddress = '0xWalletAddress';
      const swapArgs = await viemHelperProvider.initSwapArgs({ tx, walletAddress });
      expect(swapArgs.fn).toBeDefined();
      expect(swapArgs.args).toBeDefined();
      expect(swapArgs.value).toBeDefined();
    });
  });

  describe('getSharedVars', () => {
    it('should return shared variables for the network', () => {
      mockRedisService.getCachedContracts.mockResolvedValue({
        nativeToken: '0xNativeToken',
        factoryAddress: '0xFactoryAddress',
        routerAddress: '0xRouterAddress',
      });

      const sharedVars = viemHelperProvider.getSharedVars(mockNetwork);
      expect(sharedVars.chain).toBeDefined();
      expect(sharedVars.rpcUrl).toBeDefined();
      expect(sharedVars.nativeToken).toBeDefined();
      expect(sharedVars.routerAddress).toBeDefined();
    });
  });

  describe('formatBalanceResponse', () => {
    it('should format balance response', () => {
      const balanceInfo: BalanceInfo = {
        address: '0xAddress',
        network: 'BSC',
        nativeBalance: {
          symbol: 'BNB',
          amount: '100',
        },
        tokenBalances: [{ symbol: 'TOKEN', amount: '50', decimals: 18 }] as Array<{
          symbol: string;
          amount: string;
          decimals: number;
        }>,
      };

      const response = viemHelperProvider.formatBalanceResponse(balanceInfo);
      expect(response).toContain('Адрес:');
      expect(response).toContain('Сеть:');
      expect(response).toContain('BNB:');
      expect(response).toContain('TOKEN:');
    });
  });

  describe('parseEventLog', () => {
    it('should parse event log', async () => {
      const log = {
        address: '0xAddress',
        eventName: 'Swap',
        args: {
          sender: '0xSender',
          to: '0xToAddress',
          amount0In: BigInt(100),
          amount1In: BigInt(0),
          amount0Out: BigInt(0),
          amount1Out: BigInt(100),
        },
        transactionHash: '0xHash',
      } as unknown as Log;

      jest.spyOn(mockPublicClient, 'getTransaction').mockResolvedValue({ from: '0xUserAddress' } as any);

      const transaction = await viemHelperProvider.parseEventLog(log, mockNetwork);
      expect(transaction).toBeDefined();
    });
  });
});
