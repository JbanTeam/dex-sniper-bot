import { Test, TestingModule } from '@nestjs/testing';
import { anvil, bsc, polygon } from 'viem/chains';
import {
  createPublicClient,
  createWalletClient,
  parseEther,
  createTestClient,
  publicActions,
  WalletClient,
  PublicClient,
  erc20Abi,
  parseUnits,
  TransactionReceipt,
} from 'viem';

import { AnvilProvider } from '../anvil.provider';
import { RedisService } from '@modules/redis/redis.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { ViemHelperProvider } from '../../viem-helper.provider';
import { PairAddresses } from '@modules/blockchain/types';
import { CachedContractsType, CreateTokenReturnType } from '../../types';
import { Network, Address, SessionUserToken, ViemNetwork } from '@src/types/types';

const mockRedisService = {
  getCachedContracts: jest.fn(),
  setHashFeilds: jest.fn(),
  getPair: jest.fn(),
  getTxContext: jest.fn(),
  cachePair: jest.fn(),
};

const mockConstantsProvider = {
  ANVIL_RPC_URL: 'http://localhost:8545',
  ANVIL_WS_RPC_URL: 'ws://localhost:8545',
  anvilAddresses: {
    exchangeAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address,
    recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address,
  },
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
};

const mockViemHelperProvider = {
  getPair: jest.fn(),
  parseEventLog: jest.fn(),
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
  waitForTransactionReceipt: jest.fn(),
} as unknown as PublicClient;

const mockTestClient = {
  request: jest.fn(),
};

const mockToken = {
  id: 1,
  address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
  name: 'PancakeSwap Token',
  symbol: 'Cake',
  decimals: 18,
  network: Network.BSC,
} as SessionUserToken;

const mockPairAddress: Address = '0xPairForFakeSwap';
const mockToken0: Address = '0xT0';
const mockToken1: Address = '0xT1';

jest.mock('viem', () => {
  const actual = jest.requireActual('viem') as unknown as object;
  return {
    ...actual,
    createPublicClient: jest.fn(),
    createWalletClient: jest.fn(),
    createTestClient: jest.fn(() => ({
      extend: () => ({
        request: jest.fn().mockResolvedValue(undefined),
      }),
    })),
  } as unknown;
});

const readContractMock = jest.spyOn(mockPublicClient, 'readContract');
const writeContractMock = jest.spyOn(mockWalletClient, 'writeContract');
const deployContractMock = jest.spyOn(mockWalletClient, 'deployContract');

describe('AnvilProvider', () => {
  let anvilProvider: AnvilProvider;
  let constantsProvider: ConstantsProvider;
  let viemHelperProvider: ViemHelperProvider;

  beforeEach(async () => {
    jest.clearAllMocks();

    (createWalletClient as jest.Mock).mockReturnValue(mockWalletClient);
    (createPublicClient as jest.Mock).mockReturnValue(mockPublicClient);
    (createTestClient as jest.Mock).mockImplementation(() => ({
      ...mockTestClient,
      ...publicActions(mockPublicClient as any),
    }));

    mockWalletClient.getAddresses = jest
      .fn()
      .mockResolvedValue([
        mockConstantsProvider.anvilAddresses.exchangeAddress,
        mockConstantsProvider.anvilAddresses.recipientAddress,
      ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnvilProvider,
        { provide: RedisService, useValue: mockRedisService },
        { provide: ConstantsProvider, useValue: mockConstantsProvider },
        { provide: ViemHelperProvider, useValue: mockViemHelperProvider },
      ],
    }).compile();

    anvilProvider = module.get<AnvilProvider>(AnvilProvider);
    constantsProvider = module.get<ConstantsProvider>(ConstantsProvider);
    viemHelperProvider = module.get<ViemHelperProvider>(ViemHelperProvider);

    anvilProvider['cachedContracts'] = {
      nativeToken: '0xWBNB' as Address,
      factoryAddress: '0xFactory' as Address,
      routerAddress: '0xRouter' as Address,
    } as CachedContractsType;

    viemHelperProvider.getPair = jest
      .fn()
      .mockResolvedValue({ pairAddress: mockPairAddress, token0: mockToken0, token1: mockToken1 });

    jest.spyOn(anvilProvider as any, 'swap').mockResolvedValue(undefined);
    jest.spyOn(anvilProvider as any, 'getBalance').mockResolvedValue(undefined);
  });

  describe('initTestDex', () => {
    it('should deploy WBNB, Factory, and Router if not cached', async () => {
      mockRedisService.getCachedContracts.mockResolvedValueOnce({} as CachedContractsType);
      deployContractMock.mockResolvedValue('0xDeployedContractHash' as Address);
      jest
        .spyOn(mockPublicClient, 'waitForTransactionReceipt')
        .mockResolvedValueOnce({ contractAddress: '0xWBNBAddress' as Address, status: 'success' } as TransactionReceipt)
        .mockResolvedValueOnce({
          contractAddress: '0xFactoryAddress' as Address,
          status: 'success',
        } as TransactionReceipt)
        .mockResolvedValueOnce({
          contractAddress: '0xRouterAddress' as Address,
          status: 'success',
        } as TransactionReceipt);

      await anvilProvider.initTestDex();

      expect(mockRedisService.getCachedContracts).toHaveBeenCalledTimes(1);
      expect(deployContractMock).toHaveBeenCalledTimes(3); // WBNB, Factory, Router
      expect(mockRedisService.setHashFeilds).toHaveBeenCalledWith('cachedContracts', {
        nativeToken: '0xWBNBAddress'.toLowerCase(),
        factoryAddress: '0xFactoryAddress'.toLowerCase(),
        routerAddress: '0xRouterAddress'.toLowerCase(),
      });
    });

    it('should not deploy if contracts are already cached', async () => {
      mockRedisService.getCachedContracts.mockResolvedValueOnce({
        nativeToken: '0xCachedWBNB' as Address,
        factoryAddress: '0xCachedFactory' as Address,
        routerAddress: '0xCachedRouter' as Address,
      } as CachedContractsType);

      await anvilProvider.initTestDex();

      expect(deployContractMock).not.toHaveBeenCalled();
      expect(mockRedisService.setHashFeilds).not.toHaveBeenCalled();
    });
  });

  describe('initTestAddresses', () => {
    it('should get and set anvil exchange and recipient addresses', async () => {
      await anvilProvider.initTestAddresses();
      expect(mockWalletClient.getAddresses).toHaveBeenCalledTimes(1);
      expect(constantsProvider.anvilAddresses.exchangeAddress).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
      expect(constantsProvider.anvilAddresses.recipientAddress).toBe('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
    });
  });

  describe('createClients', () => {
    it('should create public and publicWebsocket clients for Anvil', () => {
      const clients = anvilProvider.createClients();
      const networkKeys = Object.keys(ViemNetwork);
      expect(clients).toHaveProperty('public');
      expect(clients).toHaveProperty('publicWebsocket');
      expect(Object.keys(clients.public)).toEqual(networkKeys);
      expect(Object.keys(clients.publicWebsocket)).toEqual(networkKeys);
    });
  });

  describe('createTestToken', () => {
    const mockCreateTokenReturn: CreateTokenReturnType = {
      tokenAddress: '0xTokenAddress' as Address,
      pairAddresses: { token0: '0xToken0', token1: '0xToken1', pairAddress: '0xPairAddress' } as PairAddresses,
    };

    it('should create a test token, set balance, and send tokens', async () => {
      jest.spyOn(anvilProvider as any, 'createToken').mockResolvedValue(mockCreateTokenReturn);
      jest.spyOn(anvilProvider as any, 'sendTestTokens').mockResolvedValue({});

      const result = await anvilProvider.createTestToken({
        token: mockToken,
        walletAddress: '0xUserWallet' as Address,
      });

      expect(anvilProvider['createToken']).toHaveBeenCalled();
      expect(anvilProvider['getBalance']).toHaveBeenCalled();
      expect(anvilProvider['sendTestTokens']).toHaveBeenCalled();
      expect(result.token.address).toBe(mockCreateTokenReturn.tokenAddress);
      expect(result.pairAddresses).toEqual(mockCreateTokenReturn.pairAddresses);
    });
  });

  describe('fakeSwapTo', () => {
    it('should perform a swap and check balance', async () => {
      await anvilProvider.fakeSwapTo(mockToken);

      expect(anvilProvider['swap']).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientAddress: constantsProvider.anvilAddresses.recipientAddress,
          amountIn: parseEther('1'),
          path: [anvilProvider['cachedContracts'].nativeToken, mockToken.address],
          fn: 'swapExactETHForTokens',
          minAmountOut: 0n,
        }),
      );
      expect(anvilProvider['getBalance']).toHaveBeenCalledWith({
        tokenAddress: mockToken.address,
        walletAddress: constantsProvider.anvilAddresses.recipientAddress,
        name: mockToken.name,
        decimals: mockToken.decimals,
      });
    });
  });

  describe('fakeSwapFrom', () => {
    it('should approve if needed, perform a swap, and check balance', async () => {
      readContractMock
        .mockResolvedValueOnce([1000n, 1000n, 0n]) // Reserves
        .mockResolvedValueOnce(parseUnits('10', mockToken.decimals)) // allowance
        .mockResolvedValueOnce([0n, 900n]); // getAmountsOut

      await anvilProvider.fakeSwapFrom(mockToken);

      expect(viemHelperProvider['getPair']).toHaveBeenCalled();
      expect(readContractMock).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'getReserves' }));
      expect(readContractMock).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'allowance' }));
      expect(writeContractMock).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'approve' }));
      expect(anvilProvider['swap']).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientAddress: constantsProvider.anvilAddresses.recipientAddress,
          amountIn: parseUnits('1000', mockToken.decimals),
          path: [mockToken.address, anvilProvider['cachedContracts'].nativeToken],
          fn: 'swapExactTokensForETH',
        }),
      );
      expect(anvilProvider['getBalance']).toHaveBeenCalledWith({
        tokenAddress: mockToken.address,
        walletAddress: constantsProvider.anvilAddresses.recipientAddress,
        name: mockToken.name,
        decimals: 18,
      });
    });

    it('should not approve if allowance is sufficient', async () => {
      readContractMock
        .mockResolvedValueOnce([1000n, 1000n, 0n]) // getReserves
        .mockResolvedValueOnce(parseUnits('1500', mockToken.decimals)) // allowance
        .mockResolvedValueOnce([0n, 900n]); // getAmountsOut

      await anvilProvider.fakeSwapFrom(mockToken);

      expect(mockWalletClient.writeContract).not.toHaveBeenCalledWith(
        expect.objectContaining({ functionName: 'approve' }),
      );
    });
  });

  describe('setTestBalance', () => {
    it('should set balance for the given address on Anvil', async () => {
      const params = {
        network: Network.BSC,
        address: '0xWalletAddress' as Address,
      };

      jest.spyOn(mockTestClient, 'request').mockResolvedValue(undefined);
      const mockRequest = jest.fn().mockResolvedValue(undefined);
      (createTestClient as jest.Mock).mockReturnValue({
        extend: () => ({
          request: mockRequest,
        }),
      });

      await anvilProvider.setTestBalance(params);

      expect(mockRequest).toHaveBeenCalledWith({
        method: 'anvil_setBalance',
        params: [params.address, `0x${parseEther('1000').toString(16)}`],
      });
    });
  });

  describe('sendTestTokens', () => {
    const params = {
      tokenAddress: '0xTokenToSend' as Address,
      sender: '0xSenderAddress' as Address,
      walletAddress: '0xWalletAddress' as Address,
      decimals: 18,
    };

    it('should send test tokens from sender to walletAddress', async () => {
      jest
        .spyOn(mockPublicClient, 'waitForTransactionReceipt')
        .mockResolvedValue({ status: 'success' } as TransactionReceipt);
      writeContractMock.mockResolvedValue('0xTransferHash');

      const amount = parseUnits('1000000.0', params.decimals);

      await anvilProvider['sendTestTokens'](params);

      expect(writeContractMock).toHaveBeenCalledWith({
        address: params.tokenAddress,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [params.walletAddress, amount],
        account: params.sender,
        chain: anvil,
      });
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: '0xTransferHash' });
    });
  });

  describe('createToken', () => {
    const params = {
      name: 'My New Token',
      symbol: 'MNT',
      decimals: 18,
      count: '1000000',
      network: Network.BSC,
    };
    const deployedTokenAddress = '0xDeployedNewToken' as Address;

    it('should deploy token, deposit wbnb, approve toren in router, and add liquidity', async () => {
      jest.spyOn(anvilProvider as any, 'deployToken').mockResolvedValue(deployedTokenAddress);
      jest.spyOn(anvilProvider as any, 'depositWbnb').mockResolvedValue(undefined);
      jest.spyOn(anvilProvider as any, 'approve').mockResolvedValue(undefined);
      jest.spyOn(anvilProvider as any, 'addLiquidity').mockResolvedValue(undefined);
      const exchangeAddress = constantsProvider.anvilAddresses.exchangeAddress;
      const recipientAddress = constantsProvider.anvilAddresses.recipientAddress;
      const result = await anvilProvider['createToken'](params);

      expect(anvilProvider['deployToken']).toHaveBeenCalledWith(
        expect.objectContaining({
          exchangeAddress,
          name: params.name,
          symbol: params.symbol,
          decimals: params.decimals,
          count: params.count,
        }),
      );
      expect(anvilProvider['depositWbnb']).toHaveBeenCalledWith(exchangeAddress);
      expect(anvilProvider['approve']).toHaveBeenCalledWith(recipientAddress, deployedTokenAddress);
      expect(anvilProvider['addLiquidity']).toHaveBeenCalledWith(
        expect.objectContaining({
          exchangeAddress,
          tokenAddress: deployedTokenAddress,
          network: params.network,
          decimals: params.decimals,
        }),
      );
      expect(result.tokenAddress).toBe(deployedTokenAddress);
      expect(result.pairAddresses.pairAddress).toBe(mockPairAddress);
    });
  });
});
