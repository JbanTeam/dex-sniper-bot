import { ChainableCommander } from 'ioredis';
import { DeleteConditions } from '@modules/user-token/types';
import {
  SessionUser,
  SessionReplication,
  SessionSubscription,
  SessionUserToken,
  Network,
  Address,
} from '@src/types/types';

type AddTokenParams = {
  chatId: number;
  token: SessionUserToken;
  tokens: SessionUserToken[];
  prefix: 'token' | 'testToken';
};

type AddPairParams = {
  network: Network;
  pairAddress: Address;
  token0: Address;
  token1: Address;
  prefix: 'pair' | 'testPair';
};

type RemoveTokenParams = {
  userSession: SessionUser;
  deleteConditions: DeleteConditions;
};

type GetPairParams = { prefix: string; pairAddress: Address; network: Network };

type PairType = { token0: Address; token1: Address };

type TxContextType = { replicationDepth: number; initiators: number[] };

type SubscriptionParams = {
  chatId: number;
  subscription: SessionSubscription;
  subscriptions: SessionSubscription[];
  replications?: SessionReplication[];
};

type DeleteTokensParams = {
  pipe: ChainableCommander;
  chatId: number;
  tokens: SessionUserToken[] | undefined;
  deletedTokens: SessionUserToken[];
  prefix: 'token' | 'testToken';
};

type FilterTokensParams = {
  userSession: SessionUser;
  deleteConditions: DeleteConditions;
};

type FilterTokensReturnType = {
  remainingTokens: { tokens: SessionUserToken[]; testTokens: SessionUserToken[] | undefined };
  replications: SessionReplication[];
  deletedTokens: SessionUserToken[];
  deletedTestTokens: SessionUserToken[];
};

type CleanTokenSetsParams = {
  deletedTokens: SessionUserToken[];
  prefix: 'token' | 'testToken';
};

export {
  AddTokenParams,
  AddPairParams,
  GetPairParams,
  PairType,
  TxContextType,
  RemoveTokenParams,
  SubscriptionParams,
  DeleteTokensParams,
  FilterTokensParams,
  FilterTokensReturnType,
  CleanTokenSetsParams,
};
