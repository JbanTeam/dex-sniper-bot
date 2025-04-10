import { Address, Network, SessionData, SessionUserToken } from '@src/types/types';

export type AddTokenParams = {
  userSession: SessionData;
  address: Address;
  network: Network;
};

export type RemoveTokenParams = {
  chatId: number;
  address?: Address;
  network?: Network;
};

export type CreateTokenEntityParams = {
  userSession: SessionData;
  address: Address;
  network: Network;
  name: string;
  symbol: string;
  decimals: number;
};

export type CreateTestTokenParams = {
  userSession: SessionData;
  sessionToken: SessionUserToken;
  existsTokenId?: string;
};

export type UpdateTokenStorageParams = {
  chatId: number;
  tokens: SessionUserToken[];
  token: SessionUserToken;
  isTest?: boolean;
};

export type DeleteConditions = {
  user: { id: number };
  network?: Network;
  address?: Address;
};
