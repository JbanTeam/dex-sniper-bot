import { EntityManager } from 'typeorm';

import { Wallet } from '@modules/wallet/wallet.entity';
import { Address, Network, SessionUser, SessionUserToken, SessionWallet } from '@src/types/types';

type CreateWalletParams = {
  userId: number;
  network: Network;
  entityManager?: EntityManager;
};

type CreateWalletReturnType = {
  network: Network;
  encryptedPrivateKey: string;
  address: Address;
};

type CheckTokenParams = {
  address: Address;
  network: Network;
};

type CheckTokenReturnType = {
  name: string;
  symbol: string;
  decimals: number;
  pairAddresses: PairAddresses;
};

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

type SendNativeParams = Omit<SendTokensParams, 'token'>;

type DeployTokenParams = { wallet: SessionWallet; token: SessionUserToken };

type Transaction = {
  eventName: string;
  pairAddress: Address;
  routerAddress: Address;
  sender: Address;
  to: Address;
  amountIn: bigint;
  amountOut: bigint;
  tokenIn: Address;
  tokenOut: Address;
  network: Network;
  hash: Address;
  initiators: number[];
  replicationDepth: number;
  data: string;
};

type PairAddresses = {
  pairAddress: Address;
  token0: Address;
  token1: Address;
};

type TokenData = {
  name: string;
  symbol: string;
  decimals: number;
  existsTokenId: string;
  pairAddresses: null | PairAddresses;
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
  CreateWalletReturnType,
  CheckTokenParams,
  CheckTokenReturnType,
  GetBalanceParams,
  GetTokenBalanceParams,
  TokenBalanceReturnType,
  SendTokensParams,
  SendNativeParams,
  DeployTokenParams,
  Transaction,
  BalanceInfo,
  PairAddresses,
  TokenData,
};
