import { Chain } from 'viem';
import { Wallet } from '@modules/wallet/wallet.entity';
import { UserToken } from '@modules/user/user-token.entity';
import { Subscription } from '@modules/subscription/subscription.entity';

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

export enum Network {
  BSC = 'BSC',
  POLYGON = 'POLYGON',
}

export type ChainConfig = {
  name: string;
  rpcUrl: string;
  rpcWsUrl: string;
  chain: Chain;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
    address: `0x${string}`;
  };
  exchange: string;
  exchangeAddress: `0x${string}`;
};

export type ChainsType = {
  [key in Network]: ChainConfig;
};

export type ExchangesType = {
  [key in Network]: {
    exchangeAddress: `0x${string}`;
    testAddress: `0x${string}`;
  };
};

export interface SessionData {
  userId: number;
  chatId: number;
  wallets: SessionWallet[];
  tokens: SessionUserToken[];
  testTokens?: SessionUserToken[];
  subscriptions: SessionSubscription[];
  action?: string;
  tempToken?: string;
  tempWallet?: string;
  tempReplication?: string;
  tempSendTokens?: string;
}

export type SessionUserToken = Omit<UserToken, 'user'>;
export type SessionWallet = Omit<Wallet, 'user'>;
export type SessionSubscription = Omit<Subscription, 'user'>;
