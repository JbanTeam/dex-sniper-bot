import { Context, SessionFlavor } from 'grammy';
import { Address, PublicClient, WalletClient } from 'viem';

import { Wallet } from '@modules/wallet/wallet.entity';

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
