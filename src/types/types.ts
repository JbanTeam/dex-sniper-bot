import { Context, SessionFlavor } from 'grammy';

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
}
