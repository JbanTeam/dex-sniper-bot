import { anvil } from 'viem/chains';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  createWalletClient,
  createPublicClient,
  http,
  formatUnits,
  parseUnits,
  createTestClient,
  publicActions,
  webSocket,
  parseEther,
  WalletClient,
  PublicClient,
  formatEther,
  erc20Abi,
} from 'viem';

import { isNetwork } from '@src/types/typeGuards';
import { BotError } from '@src/errors/BotError';
import { RedisService } from '@modules/redis/redis.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { ViemHelperProvider } from '../viem-helper.provider';
import { abi as coinAbi, bytecode as coinBytecode } from '@src/contract-artifacts/MyToken.json';
import { abi as factoryAbi, bytecode as factoryBytecode } from '@src/contract-artifacts/UniswapV2Factory.json';
import { abi as routerAbi, bytecode as routerBytecode } from '@src/contract-artifacts/UniswapV2Router02.json';
import { abi as wbnbAbi, bytecode as wbnbBytecode } from '@src/contract-artifacts/MockWBNB.json';
import { Network, SessionUserToken, Address, ViemNetwork } from '@src/types/types';
import {
  TestBalanceParams,
  SendTestTokenParams,
  CreateTestTokenParams,
  ViemClientsType,
  CreateTokenParams,
  CachedContractsType,
  CreateTokenReturnType,
  DeployTokenParams,
  AnvilSwapParams,
  AddLiquidityParams,
  CreateTestTokenReturnType,
} from '../types';

@Injectable()
export class AnvilProvider {
  private readonly walletClient: WalletClient;
  private readonly publicClient: PublicClient;
  private cachedContracts: CachedContractsType = {} as CachedContractsType;
  private readonly rpcUrl: string;
  private readonly rpcWsUrl: string;

  constructor(
    private readonly redisService: RedisService,
    private readonly constants: ConstantsProvider,
    @Inject(forwardRef(() => ViemHelperProvider))
    private readonly viemHelper: ViemHelperProvider,
  ) {
    this.rpcUrl = this.constants.ANVIL_RPC_URL;
    this.rpcWsUrl = this.constants.ANVIL_WS_RPC_URL;
    this.walletClient = createWalletClient({
      chain: anvil,
      transport: http(this.rpcUrl),
    });
    this.publicClient = createPublicClient({
      chain: anvil,
      transport: http(this.rpcUrl),
    });
  }

  async initTestDex(): Promise<void> {
    const { exchangeAddress } = this.constants.anvilAddresses;
    this.cachedContracts = await this.redisService.getCachedContracts();
    const { nativeToken, factoryAddress, routerAddress } = this.cachedContracts;

    if (!nativeToken) await this.deployWbnb(exchangeAddress);
    if (!factoryAddress) await this.deployFactory(exchangeAddress);
    if (!routerAddress) await this.deployRouter(exchangeAddress);

    if (!nativeToken || !factoryAddress || !routerAddress) {
      await this.redisService.setHashFeilds('cachedContracts', this.cachedContracts);
    }
  }

  async initTestAddresses(): Promise<void> {
    const [exchangeAddress, recipientAddress] = await this.walletClient.getAddresses();
    this.constants.anvilAddresses.exchangeAddress = exchangeAddress;
    this.constants.anvilAddresses.recipientAddress = recipientAddress;
  }

  createClients(): ViemClientsType {
    const chainsArr = Object.keys(ViemNetwork);
    return chainsArr.reduce(
      (clients, keyNetwork) => {
        isNetwork(keyNetwork);
        clients.public[keyNetwork] = createPublicClient({
          chain: anvil,
          transport: http(this.rpcUrl),
        });

        clients.publicWebsocket[keyNetwork] = createPublicClient({
          chain: anvil,
          transport: webSocket(this.rpcWsUrl),
        });

        return clients;
      },
      { public: {}, publicWebsocket: {} } as ViemClientsType,
    );
  }

  async createTestToken({
    token,
    count = '1000000000',
    walletAddress,
  }: CreateTestTokenParams): Promise<CreateTestTokenReturnType> {
    const { name, symbol, decimals, network } = token;
    const { exchangeAddress, tokenAddress, pairAddresses } = await this.createToken({
      name,
      symbol,
      decimals,
      count,
      network,
    });

    await this.getBalance({ tokenAddress, walletAddress: exchangeAddress, name, decimals });
    await this.sendTestTokens({ tokenAddress, sender: exchangeAddress, walletAddress, decimals });

    return {
      token: {
        ...token,
        address: tokenAddress,
      },
      pairAddresses,
    };
  }

  async sendFakeSwap(testToken: SessionUserToken): Promise<void> {
    const { recipientAddress } = this.constants.anvilAddresses;

    const value = parseEther('1');
    const path = [this.cachedContracts.nativeToken, testToken.address];
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60);

    await this.swap({
      recipientAddress,
      value,
      deadline,
      path,
      fn: 'swapExactETHForTokens',
    });

    await this.getBalance({
      tokenAddress: testToken.address,
      walletAddress: recipientAddress,
      name: testToken.name,
      decimals: testToken.decimals,
    });
  }

  async setTestBalance({ network, address }: { network: Network; address: Address }): Promise<void> {
    try {
      const client = createTestClient({
        mode: 'anvil',
        chain: this.constants.chains[network].chain,
        transport: http(this.rpcUrl),
      }).extend(publicActions);

      await client.request({
        method: 'anvil_setBalance',
        params: [address, `0x${parseEther('1000').toString(16)}`],
      });
    } catch (error) {
      console.error(error);
      throw new BotError(`Error setting balance`, `Ошибка установления баланса`, 400);
    }
  }

  private async createToken({
    name,
    symbol,
    decimals,
    count,
    network,
  }: CreateTokenParams): Promise<CreateTokenReturnType> {
    const { exchangeAddress } = this.constants.anvilAddresses;

    const tokenAddress = await this.deployToken({ exchangeAddress, name, symbol, decimals, count });
    await this.depositWbnb(exchangeAddress);
    await this.approve(exchangeAddress, tokenAddress);
    await this.addLiquidity({ exchangeAddress, tokenAddress, network, decimals });

    const nativeToken = this.cachedContracts.nativeToken;
    const factoryAddress = this.cachedContracts.factoryAddress;
    const publicClient = this.publicClient;
    const pairAddresses = await this.viemHelper.getPair({ tokenAddress, nativeToken, factoryAddress, publicClient });

    return { exchangeAddress, tokenAddress, pairAddresses };
  }

  private async getBalance({ tokenAddress, walletAddress, decimals, name }: TestBalanceParams): Promise<void> {
    const nativeBalance = await this.publicClient.getBalance({ address: walletAddress });

    const balance = await this.viemHelper.balanceOf({ tokenAddress, walletAddress, publicClient: this.publicClient });

    const formattedBalance = formatUnits(balance, decimals);
    const formattedNativeBalance = formatEther(nativeBalance);

    console.log(`💰 Native Баланс:`, formattedNativeBalance);
    console.log(`💰 Баланс ${name}:`, formattedBalance);
  }

  private async sendTestTokens({ tokenAddress, sender, walletAddress, decimals }: SendTestTokenParams): Promise<void> {
    const amount = parseUnits('1000000.0', decimals);

    const hash = await this.walletClient.writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      chain: anvil,
      functionName: 'transfer',
      args: [walletAddress, amount],
      account: sender,
    });

    console.log('#️⃣ Transaction hash:', hash);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
      throw new BotError(`Test tokens not sent ❌`, `Тестовый токены не были отправлены ❌`, 400);
    }

    console.log('✅ Токены отправлены', receipt);
  }

  private async deployWbnb(exchangeAddress: Address): Promise<void> {
    console.log('Deploying WBNB...');
    const hash = await this.walletClient.deployContract({
      abi: wbnbAbi,
      bytecode: wbnbBytecode as `0x${string}`,
      chain: anvil,
      account: exchangeAddress,
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) {
      throw new BotError(`WBNB not created ❌`, `WBNB не был создан ❌`, 400);
    }
    this.cachedContracts.nativeToken = receipt.contractAddress.toLowerCase() as Address;

    await this.depositWbnb(exchangeAddress);
  }

  private async deployToken({ exchangeAddress, name, symbol, decimals, count }: DeployTokenParams): Promise<Address> {
    console.log(`Deploying ${name}...`);
    const txHash = await this.walletClient.deployContract({
      abi: coinAbi,
      chain: anvil,
      bytecode: coinBytecode as `0x${string}`,
      account: exchangeAddress,
      args: [name, symbol, decimals, count],
    });

    console.log(`✅ Контракт ${name} отправлен, Транзакция: ${txHash}`);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    if (!receipt.contractAddress) {
      throw new BotError(`Test contract ${name} not created ❌`, `Тестовый контракт ${name} не был создан ❌`, 400);
    }

    const tokenAddress = receipt.contractAddress.toLowerCase() as Address;
    console.log(`✅ Контракт развернут по адресу: ${tokenAddress}`);

    return tokenAddress;
  }

  private async depositWbnb(exchangeAddress: Address): Promise<void> {
    console.log('Depositing WBNB...');
    await this.walletClient.writeContract({
      address: this.cachedContracts.nativeToken,
      abi: wbnbAbi,
      functionName: 'deposit',
      args: [],
      chain: anvil,
      value: parseEther('100'),
      account: exchangeAddress,
    });
  }

  private async deployFactory(exchangeAddress: Address): Promise<void> {
    console.log('Deploying Factory...');
    const hash = await this.walletClient.deployContract({
      abi: factoryAbi,
      bytecode: factoryBytecode as `0x${string}`,
      chain: anvil,
      account: exchangeAddress,
      args: ['0x0000000000000000000000000000000000000000'],
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) {
      throw new BotError(`Factory not created ❌`, `Factory не был создан ❌`, 400);
    }
    this.cachedContracts.factoryAddress = receipt.contractAddress.toLowerCase() as Address;
  }

  private async deployRouter(exchangeAddress: Address): Promise<void> {
    console.log('Deploying Router...');
    const hash = await this.walletClient.deployContract({
      abi: routerAbi,
      bytecode: routerBytecode as `0x${string}`,
      chain: anvil,
      account: exchangeAddress,
      args: [this.cachedContracts.factoryAddress, this.cachedContracts.nativeToken],
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) {
      throw new BotError(`Router not created ❌`, `Router не был создан ❌`, 400);
    }
    this.cachedContracts.routerAddress = receipt.contractAddress.toLowerCase() as Address;

    console.log('Approving Router for WBNB...');
    await this.walletClient.writeContract({
      address: this.cachedContracts.nativeToken,
      abi: wbnbAbi,
      functionName: 'approve',
      chain: anvil,
      args: [this.cachedContracts.routerAddress, 2n ** 256n - 1n],
      account: exchangeAddress,
    });
  }

  private async approve(exchangeAddress: Address, tokenAddress: Address): Promise<void> {
    console.log('Approving Router for token...');
    await this.walletClient.writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      chain: anvil,
      args: [this.cachedContracts.routerAddress, 2n ** 256n - 1n],
      account: exchangeAddress,
    });
  }

  private async swap({ recipientAddress, value, deadline, path, fn }: AnvilSwapParams): Promise<void> {
    const hash = await this.walletClient.writeContract({
      address: this.cachedContracts.routerAddress,
      abi: routerAbi,
      functionName: fn,
      args: [0n, path, recipientAddress, deadline],
      chain: anvil,
      account: recipientAddress,
      value,
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new BotError(`Swap not done ❌`, `Swap не был выполнен ❌`, 400);
    }

    console.log('#️⃣ Swap tx hash:', hash);
  }

  private async addLiquidity({ exchangeAddress, tokenAddress, network, decimals }: AddLiquidityParams): Promise<void> {
    console.log('Adding liquidity...');
    const nativeToken = this.cachedContracts.nativeToken;
    const nativeDecimals = this.constants.chains[network].tokenDecimals;
    const hash = await this.walletClient.writeContract({
      address: this.cachedContracts.routerAddress,
      abi: routerAbi,
      functionName: 'addLiquidity',
      chain: anvil,
      args: [
        tokenAddress,
        nativeToken,
        parseUnits('100000', decimals),
        parseUnits('100', nativeDecimals),
        0n,
        0n,
        exchangeAddress,
        BigInt(Math.floor(Date.now() / 1000) + 600),
      ],
      account: exchangeAddress,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
      throw new BotError(`Liquidity not added ❌`, `Ликвидность не была добавлена ❌`, 400);
    }
  }
}
