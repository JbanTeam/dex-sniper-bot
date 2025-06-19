import { Chain } from 'viem';
import { Wallet } from '@modules/wallet/wallet.entity';
import { UserToken } from '@modules/user-token/user-token.entity';
import { Subscription } from '@modules/subscription/subscription.entity';
import { ViemProvider } from '@modules/blockchain/viem/viem.provider';
import { AnvilProvider } from '@modules/blockchain/viem/anvil/anvil.provider';

export interface BotProviderInterface<SendMsgParams = any, DeleteMsgParams = any> {
  start(): Promise<void>;
  sendMessage(params: SendMsgParams): Promise<void>;
  deleteMessage(params: DeleteMsgParams): Promise<void>;
  onMessage(): Promise<void>;
}

export type IncomingMessage = {
  chatId: number;
  text: string;
  timestamp: Date;
  messageId: number;
  user?: {
    id: number;
    username?: string;
  };
};

export type IncomingQuery = Omit<IncomingMessage, 'text'> & {
  data: string;
  query_id: number;
};

export type Address = `0x${string}`;

export enum TokenAddressType {
  NATIVE = 'native',
}

export enum NetworkType {
  ALL = 'all',
}

export enum BuySell {
  BUY = 'buy',
  SELL = 'sell',
}

export const ViemNetwork = {
  BSC: 'BSC',
  POLYGON: 'POLYGON',
} as const;

export const SolanaNetwork = {
  // SOLANA: 'SOLANA',
} as const;

export const Network = {
  ...ViemNetwork,
  ...SolanaNetwork,
} as const;

export type Network = keyof typeof Network;
export type ViemNetwork = keyof typeof ViemNetwork;
// export type SolanaNetwork = keyof typeof SolanaNetwork;

export type NetworkProviders = {
  [K in Network]: K extends ViemNetwork ? ViemProvider : never;
};
export type TestNetworkProviders = {
  [K in Network]: K extends ViemNetwork ? AnvilProvider : never;
};

export type ViemChainConfig = {
  name: string;
  rpcUrl: string;
  rpcWsUrl: string;
  chain: Chain;
  nativeToken: Address;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  exchange: string;
  routerAddress: Address;
  factoryAddress: Address;
};

export type ChainsType = {
  [key in Network]: ViemChainConfig;
};

export type ExchangesType = {
  [key in Network]: {
    exchangeAddress: Address;
    recipientAddress: Address;
  };
};

export type TempReplication = {
  action: 'buy' | 'sell';
  limit: number;
  userId?: number;
  chatId?: number;
  network?: Network;
  subscriptionId?: number;
  tokenId?: number;
};

export type SessionUser = {
  userId: number;
  chatId: number;
  wallets: SessionWallet[];
  tokens: SessionUserToken[];
  testTokens?: SessionUserToken[];
  subscriptions: SessionSubscription[];
  replications: SessionReplication[];
  action?: string;
  tempToken?: string;
  tempWallet?: string;
  tempReplication?: TempReplication;
  tempSendTokens?: string;
};

export type SessionUserToken = Omit<UserToken, 'user' | 'replications'>;
export type SessionWallet = Omit<Wallet, 'user'>;
export type SessionSubscription = Omit<Subscription, 'user' | 'replications'>;
export type SessionReplication = {
  id: number;
  chatId: number;
  userId: number;
  buy: number;
  sell: number;
  network: Network;
  tokenId: number;
  tokenSymbol: string;
  tokenAddress: Address;
  tokenDecimals: number;
  subscriptionId: number;
  subscriptionAddress: Address;
};
