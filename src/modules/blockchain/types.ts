import { EntityManager } from 'typeorm';

import { Wallet } from '@modules/wallet/wallet.entity';
import { Address, Network, SessionUser, SessionUserToken, SessionWallet } from '@src/types/types';

type CreateWalletParams = {
  userId: number;
  network: Network;
  entityManager?: EntityManager;
};

type CheckTokenParams = {
  address: Address;
  network: Network;
};

type CheckTokenReturnType = { name: string; symbol: string; decimals: number };

type GetBalanceParams = {
  chatId: number;
  address: Address;
  network: Network;
};

type GetTokenBalanceParams = {
  tokenAddress: Address;
  walletAddress: Address;
  network: Network;
};

type TokenBalanceReturnType = { symbol: string; amount: string; decimals: number };

type SendTokensParams = {
  userSession: SessionUser;
  wallet: Wallet;
  token: SessionUserToken;
  amount: string;
  recipientAddress: Address;
};

type DeployTestContractParams = { wallet: SessionWallet; token: SessionUserToken };

type Transaction = {
  eventName: string;
  routerAddress: Address;
  sender: Address;
  amountIn: bigint;
  amountOut: bigint;
  tokenIn: Address;
  tokenOut: Address;
  network: Network;
  data: string;
};

type BalanceInfo = {
  address: Address;
  network: Network;
  nativeBalance: {
    symbol: string;
    amount: string;
  };
  tokenBalances: Array<{
    symbol: string;
    amount: string;
    decimals: number;
  }>;
};

export {
  CreateWalletParams,
  CheckTokenParams,
  CheckTokenReturnType,
  GetBalanceParams,
  GetTokenBalanceParams,
  TokenBalanceReturnType,
  SendTokensParams,
  DeployTestContractParams,
  Transaction,
  BalanceInfo,
};
