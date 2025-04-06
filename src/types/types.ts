import { Wallet } from '@modules/wallet/wallet.entity';
import { UserToken } from '@modules/user/user-token.entity';
import { Subscription } from '@modules/subscription/subscription.entity';

export interface BotProviderInterface {
  sendMessage({
    chatId,
    text,
    options,
  }: {
    chatId: number;
    text: string;
    options?: SendMessageOptions;
  }): Promise<void> | Promise<MessageResponse>;
  deleteMessage({ chatId, messageId }: { chatId: number; messageId: number }): Promise<void>;
  onMessage(callback: (message: IncomingMessage | IncomingQuery) => void | Promise<void>): Promise<void>;
}

export interface SendMessageOptions {
  parse_mode?: 'html' | 'markdown' | 'markdownv2';
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_markup?: object;
}

export interface MessageResponse {
  ok: boolean;
  description?: string;
  result: {
    message_id: number;
    chat: {
      id: number;
    };
    text: string;
  };
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

export interface SessionData {
  userId: number;
  chatId: number;
  telegramUserId: number;
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

export type UpdateSubscriptionParams = {
  chatId: number;
  subscription: Subscription;
  action: 'buy' | 'sell';
  limit: number;
};
