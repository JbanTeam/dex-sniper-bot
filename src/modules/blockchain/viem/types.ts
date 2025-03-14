import { Address, publicActions, PublicClient, TestClient, walletActions, WalletClient } from 'viem';

import { Network } from '@src/types/types';
import { UserToken } from '@modules/user/user-token.entity';
import { Wallet } from '@modules/wallet/wallet.entity';

type ViemClientsType = {
  public: {
    [key in Network]: PublicClient;
  };
  wallet: {
    [key in Network]: WalletClient;
  };
  test?: TestClient;
};

type TestPuplicClient = TestClient & ReturnType<typeof publicActions>;
type TestWalletClient = TestClient & ReturnType<typeof walletActions>;

type DeployTestContractParams = {
  name: string;
  symbol: string;
  decimals: number;
  count?: string;
  network: Network;
  walletAddress: Address;
};

type SaveTestTokensParams = {
  wallets: Wallet[];
  network: Network;
  name: string;
  symbol: string;
  decimals: number;
};

type CreateTestTokensParams = {
  wallets: Wallet[];
  tokens: UserToken[];
  chatId?: number;
};

type TestBalanceParams = {
  contractAddress: Address;
  testAccount: Address;
  decimals: number;
  name: string;
};

type SendTestTokenParams = {
  contractAddress: Address;
  testAccount: Address;
  walletAddress: Address;
  decimals: number;
};

export {
  ViemClientsType,
  TestPuplicClient,
  TestWalletClient,
  CreateTestTokensParams,
  DeployTestContractParams,
  TestBalanceParams,
  SendTestTokenParams,
  SaveTestTokensParams,
};
