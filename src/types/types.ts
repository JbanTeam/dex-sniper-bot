import { Context, SessionFlavor } from 'grammy';
import { Address, PublicClient, WalletClient } from 'viem';

import { Wallet } from '@modules/wallet/wallet.entity';
import { UserToken } from '@modules/user/user-token.entity';

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

type CustomState = {
  state: {
    action: string;
  };
};

export type BotContext = Context & SessionFlavor<SessionData> & CustomState;

export enum Network {
  BSC = 'BSC',
  POLYGON = 'POLYGON',
}

export interface SessionData {
  tempToken?: string;
  tempNetwork?: Network;
  userId?: number;
  chatId?: number;
  telegramUserId?: number;
  wallets?: Wallet[];
  tokens?: UserToken[];
  action?: string;
}

export type ViemClientsType = {
  public: {
    [key in Network]: PublicClient;
  };
  wallet: {
    [key in Network]: WalletClient;
  };
};

export type DeleteConditions = {
  user: { id: number };
  network?: Network;
  address?: Address;
};
