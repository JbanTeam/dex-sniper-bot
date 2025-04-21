import { anvil } from 'viem/chains';
import { Injectable } from '@nestjs/common';
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
  erc20Abi as anvilAbi,
} from 'viem';

import { isNetwork } from '@src/types/typeGuards';
import { BotError } from '@src/errors/BotError';
import { RedisService } from '@modules/redis/redis.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { abi as coinAbi, bytecode as coinBytecode } from '@src/contract-artifacts/MyToken.json';
import { abi as factoryAbi, bytecode as factoryBytecode } from '@src/contract-artifacts/UniswapV2Factory.json';
import { abi as routerAbi, bytecode as routerBytecode } from '@src/contract-artifacts/UniswapV2Router02.json';
import { abi as wbnbAbi, bytecode as wbnbBytecode } from '@src/contract-artifacts/MockWBNB.json';
import { Network, SessionUserToken, Address, ViemNetwork } from '@src/types/types';
import {
  TestBalanceParams,
  SendTestTokenParams,
  DeployTestContractParams,
  ViemClientsType,
  DeployContractParams,
  CachedContractsType,
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

  async initTestDex() {
    const { exchangeAddress } = this.constants.anvilAddresses;
    this.cachedContracts = await this.redisService.getCachedContracts();

    if (!this.cachedContracts.wbnb) {
      console.log('Deploying WBNB...');
      const hash = await this.walletClient.deployContract({
        abi: wbnbAbi,
        chain: anvil,
        bytecode: wbnbBytecode as `0x${string}`,
        account: exchangeAddress,
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      if (!receipt.contractAddress) {
        throw new BotError(`WBNB not created ❌`, `WBNB не был создан ❌`, 400);
      }
      this.cachedContracts.wbnb = receipt.contractAddress.toLowerCase() as Address;

      console.log('Depositing ETH to WBNB...');
      await this.walletClient.writeContract({
        address: this.cachedContracts.wbnb,
        abi: wbnbAbi,
        functionName: 'deposit',
        chain: anvil,
        account: exchangeAddress,
        value: parseEther('100'),
      });
    }

    if (!this.cachedContracts.factory) {
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
      this.cachedContracts.factory = receipt.contractAddress.toLowerCase() as Address;
    }

    if (!this.cachedContracts.router) {
      console.log('Deploying Router...');
      const hash = await this.walletClient.deployContract({
        abi: routerAbi,
        bytecode: routerBytecode as `0x${string}`,
        chain: anvil,
        account: exchangeAddress,
        args: [this.cachedContracts.factory, this.cachedContracts.wbnb],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      if (!receipt.contractAddress) {
        throw new BotError(`Router not created ❌`, `Router не был создан ❌`, 400);
      }
      this.cachedContracts.router = receipt.contractAddress.toLowerCase() as Address;

      console.log('Approving Router for WBNB...');
      await this.walletClient.writeContract({
        address: this.cachedContracts.wbnb,
        abi: wbnbAbi,
        functionName: 'approve',
        chain: anvil,
        args: [this.cachedContracts.router, 2n ** 256n - 1n],
        account: exchangeAddress,
      });

      await this.redisService.setHashFeilds('cachedContracts', this.cachedContracts);
    }
  }

  createClients(): ViemClientsType {
    const chainsArr = Object.keys(ViemNetwork);
    // TODO: test anvil chain
    return chainsArr.reduce(
      (clients, keyNetwork) => {
        isNetwork(keyNetwork);
        // const value = this.constants.chains[keyNetwork];
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

  async deployTestContract({
    token,
    count = '1000000000',
    walletAddress,
  }: DeployTestContractParams): Promise<SessionUserToken> {
    const { name, symbol, decimals } = token;
    const { exchangeAddress, contractAddress } = await this.deployContract({
      name,
      symbol,
      decimals,
      count,
    });

    await this.getBalance({ contractAddress, testAccount: exchangeAddress, name, decimals });
    await this.sendTestTokens({ contractAddress, testAccount: exchangeAddress, walletAddress, decimals });

    return {
      ...token,
      address: contractAddress,
    };
  }

  async initTestAddresses() {
    const [exchangeAddress, recipientAddress] = await this.walletClient.getAddresses();
    this.constants.anvilAddresses.exchangeAddress = exchangeAddress;
    this.constants.anvilAddresses.recipientAddress = recipientAddress;
  }

  async sendFakeSwap(testToken: SessionUserToken) {
    const { recipientAddress } = this.constants.anvilAddresses;

    const value = parseEther('1');
    const path = [this.cachedContracts.wbnb, testToken.address];
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60);

    const hash = await this.walletClient.writeContract({
      address: this.cachedContracts.router,
      abi: routerAbi,
      functionName: 'swapExactETHForTokens',
      args: [0n, path, recipientAddress, deadline],
      chain: anvil,
      account: recipientAddress,
      value,
    });

    console.log('#️⃣ Swap tx hash:', hash);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
      throw new BotError(`Swap failed ❌`, `Обмен BNB на ${testToken.name} не удался ❌`, 400);
    }

    await this.getBalance({
      contractAddress: testToken.address,
      testAccount: recipientAddress,
      name: testToken.name,
      decimals: testToken.decimals,
    });
  }

  async setTestBalance({ network, address }: { network: Network; address: Address }) {
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

  private async deployContract({ name, symbol, decimals, count }: DeployContractParams): Promise<{
    exchangeAddress: Address;
    contractAddress: Address;
  }> {
    const { exchangeAddress } = this.constants.anvilAddresses;

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

    const contractAddress = receipt.contractAddress.toLowerCase() as Address;
    console.log(`✅ Контракт развернут по адресу: ${contractAddress}`);

    console.log('Depositing WBNB...');
    await this.walletClient.writeContract({
      address: this.cachedContracts.wbnb,
      abi: wbnbAbi,
      functionName: 'deposit',
      args: [],
      chain: anvil,
      value: parseEther('100'),
      account: exchangeAddress,
    });

    console.log('Approving Router for token...');
    await this.walletClient.writeContract({
      address: contractAddress,
      abi: coinAbi,
      functionName: 'approve',
      chain: anvil,
      args: [this.cachedContracts.router, 2n ** 256n - 1n],
      account: exchangeAddress,
    });

    console.log('Adding liquidity...');
    await this.walletClient.writeContract({
      address: this.cachedContracts.router,
      abi: routerAbi,
      functionName: 'addLiquidity',
      chain: anvil,
      args: [
        contractAddress,
        this.cachedContracts.wbnb,
        parseEther('100000'),
        parseEther('100'),
        0n,
        0n,
        exchangeAddress,
        BigInt(Math.floor(Date.now() / 1000) + 600),
      ],
      account: exchangeAddress,
    });

    return { exchangeAddress, contractAddress };
  }

  private async getBalance({ contractAddress, testAccount, decimals, name }: TestBalanceParams) {
    const nativeBalance = await this.publicClient.getBalance({ address: testAccount });

    const balance = await this.publicClient.readContract({
      address: contractAddress,
      abi: anvilAbi,
      functionName: 'balanceOf',
      args: [testAccount],
    });

    const formattedBalance = formatUnits(balance, decimals);
    const formattedNativeBalance = formatEther(nativeBalance);

    console.log(`💰 Native Баланс:`, formattedNativeBalance);
    console.log(`💰 Баланс ${name}:`, formattedBalance);
  }

  private async sendTestTokens({ contractAddress, testAccount, walletAddress, decimals }: SendTestTokenParams) {
    const amount = parseUnits('1000000.0', decimals);

    const hash = await this.walletClient.writeContract({
      address: contractAddress,
      abi: anvilAbi,
      chain: anvil,
      functionName: 'transfer',
      args: [walletAddress, amount],
      account: testAccount,
    });

    console.log('#️⃣ Transaction hash:', hash);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
      throw new BotError(`Test tokens not sent ❌`, `Тестовый токены не были отправлены ❌`, 400);
    }

    console.log('✅ Токены отправлены', receipt);
  }
}
