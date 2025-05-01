import { PairAddresses } from '@modules/blockchain/types';
import { Address, Network, SessionUser, SessionUserToken } from '@src/types/types';

type AddTokenParams = {
  userSession: SessionUser;
  address: Address;
  network: Network;
};

type RemoveTokenParams = {
  chatId: number;
  address?: Address;
  network?: Network;
};

type CreateTokenEntityParams = {
  userSession: SessionUser;
  address: Address;
  network: Network;
  name: string;
  symbol: string;
  decimals: number;
};

type CreateAndSaveTokenReturnType = {
  tokens: SessionUserToken[];
  sessionToken: SessionUserToken;
  existsTokenId: string;
  pairAddresses: PairAddresses | null;
};

type CreateTestTokenParams = {
  userSession: SessionUser;
  sessionToken: SessionUserToken;
  existsTokenId?: string;
};

type UpdateTokenStorageParams = {
  chatId: number;
  tokens: SessionUserToken[];
  token: SessionUserToken;
  isTest?: boolean;
};

type DeleteConditions = {
  user: { id: number };
  network?: Network;
  address?: Address;
};

export {
  AddTokenParams,
  RemoveTokenParams,
  CreateTokenEntityParams,
  CreateAndSaveTokenReturnType,
  CreateTestTokenParams,
  UpdateTokenStorageParams,
  DeleteConditions,
};
