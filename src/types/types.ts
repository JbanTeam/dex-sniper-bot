import { Chain } from 'viem';
import { Wallet } from '@modules/wallet/wallet.entity';
import { UserToken } from '@modules/user/user-token.entity';
import { Subscription } from '@modules/subscription/subscription.entity';
import { ViemProvider } from '@modules/blockchain/viem/viem.provider';

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

export type Network = (typeof Network)[keyof typeof Network];
export type ViemNetwork = (typeof ViemNetwork)[keyof typeof ViemNetwork];

export type NetworkProviders = Record<Network, ViemProvider>;

export type ViemChainConfig = {
  name: string;
  rpcUrl: string;
  rpcWsUrl: string;
  chain: Chain;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
    address: Address;
  };
  exchange: string;
  routerAddresses: Address[];
  exchangeAddress: Address;
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
  subscriptionId: number;
  subscriptionAddress: Address;
};
