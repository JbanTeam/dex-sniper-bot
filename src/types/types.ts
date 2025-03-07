import { Context, SessionFlavor } from 'grammy';
import { Address, PublicClient, WalletClient } from 'viem';

import { Wallet } from '@modules/wallet/wallet.entity';

export interface BotProviderInterface {
  sendMessage(chatId: number, text: string): Promise<void> | Promise<TelegramMessageResponse>;
  onMessage(callback: (message: IncomingMessage) => void | Promise<void>): Promise<void>;
}

export interface SendMessageOptions {
  parse_mode?: 'html' | 'markdown' | 'markdownv2';
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
}

export interface TelegramMessageResponse {
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
  user?: {
    id: number;
    username?: string;
  };
};

export interface TelegramUpdate {
  update_id: number;
  message: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username: string;
      language_code: string;
    };
    chat: {
      id: number;
      first_name: string;
      username: string;
      type: string;
    };
    date: number;
    text: string;
  };
}

export interface TelegramUpdateResponse {
  ok: boolean;
  result: TelegramUpdate[];
  description?: string;
}

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
  state?: 'ADDING_TOKEN' | 'WAITING_WALLET_TYPE';
  tempToken?: string;
  tempNetwork?: Network;
  userId?: number;
  chatId?: number;
  telegramUserId?: number;
  wallets?: Wallet[];
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
