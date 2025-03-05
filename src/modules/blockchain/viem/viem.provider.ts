import { Injectable } from '@nestjs/common';
import { isEthereumAddress } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, createPublicClient, http, parseAbi, Address, ContractFunctionExecutionError } from 'viem';

import { chains } from '@src/utils/constants';
import { encryptPrivateKey } from '@src/utils/crypto';
import { Network, ViemClientsType } from '@src/types/types';

@Injectable()
export class ViemProvider {
  private clients: ViemClientsType;

  private erc20Abi = parseAbi([
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
  ]);

  constructor(private readonly configService: ConfigService) {
    this.clients = this.createClients();
  }

  async createWallet(network: Network) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    return {
      network,
      encryptedPrivateKey: encryptPrivateKey({ privateKey, configService: this.configService }),
      address: account.address,
    };
  }

  private createClients(): ViemClientsType {
    const chainsArr = Object.entries(chains(this.configService));
    return chainsArr.reduce(
      (clients, [keyNetwork, value]) => {
        if (!chains(this.configService)[keyNetwork]) {
          throw new Error(`Неверная сеть: ${keyNetwork}`);
        }

        clients.public[keyNetwork] = createPublicClient({
          chain: value.chain,
          transport: http(value.rpcUrl),
        });

        clients.wallet[keyNetwork] = createWalletClient({
          chain: value.chain,
          transport: http(value.rpcUrl),
        });

        return clients;
      },
      { public: {}, wallet: {} } as ViemClientsType,
    );
  }

  async checkToken({
    address,
    network,
  }: {
    address: Address;
    network: Network;
  }): Promise<{ name: string; symbol: string; decimals: number }> {
    if (!isEthereumAddress(address)) {
      throw new Error('Неверный формат адреса токена');
    }

    const networkClient = this.clients.public[network];
    try {
      const chainId = await networkClient.getChainId();
      const curChain = chains(this.configService)[network];
      if (chainId !== curChain.chain.id) {
        throw new Error(`Ошибка подключения к сети ${curChain.name}`);
      }

      const [name, symbol, decimals] = await Promise.all([
        networkClient.readContract({ address, abi: this.erc20Abi, functionName: 'name' }),
        networkClient.readContract({ address, abi: this.erc20Abi, functionName: 'symbol' }),
        networkClient.readContract({ address, abi: this.erc20Abi, functionName: 'decimals' }),
      ]);

      return {
        name,
        symbol,
        decimals,
      };
    } catch (error) {
      console.error(error);
      if (error instanceof ContractFunctionExecutionError) {
        throw new Error(`Этого токена не существует в сети ${network}`);
      }
      throw new Error(`Ошибка проверки токена`);
    }
  }

  // async getBalance(address: string, network: Network): Promise<string> {
  //   const balance = await this.clients[network].getBalance({ address });
  //   return parseEther(balance.toString());
  // }
}
