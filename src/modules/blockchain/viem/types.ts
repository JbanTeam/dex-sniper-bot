import { PublicClient } from 'viem';

import { Wallet } from '@modules/wallet/wallet.entity';
import { Address, SessionUserToken, ViemNetwork } from '@src/types/types';

type ViemClientsType = {
  public: {
    [key in ViemNetwork]: PublicClient;
  };
  publicWebsocket: {
    [key in ViemNetwork]: PublicClient;
  };
};

type DeployTestContractParams = {
  token: SessionUserToken;
  count?: string;
  walletAddress: Address;
};

type DeployContractParams = {
  name: string;
  symbol: string;
  decimals: number;
  count: string;
};

type SendTransactionParams = {
  tokenAddress: Address;
  wallet: Wallet;
  recipientAddress: Address;
  amount: string;
  decimals: number;
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
  DeployTestContractParams,
  DeployContractParams,
  TestBalanceParams,
  SendTransactionParams,
  SendTestTokenParams,
};
