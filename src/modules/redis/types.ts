import { DeleteConditions, SessionData, SessionSubscription, SessionUserToken } from '@src/types/types';
import { ChainableCommander } from 'ioredis';

type AddTokenParams = {
  chatId: number;
  token: SessionUserToken;
  tokens: SessionUserToken[];
  prefix: 'token' | 'testToken';
};

type RemoveTokenParams = {
  userSession: SessionData;
  deleteConditions: DeleteConditions;
};

type SubscriptionParams = {
  chatId: number;
  subscription: SessionSubscription;
  subscriptions: SessionSubscription[];
};

type DeleteTokensParams = {
  pipe: ChainableCommander;
  chatId: number;
  tokens: SessionUserToken[] | undefined;
  deletedTokens: SessionUserToken[];
  prefix: 'token' | 'testToken';
};

type FilterTokensParams = {
  userSession: SessionData;
  deleteConditions: DeleteConditions;
  nodeEnv: string;
};

type CleanTokenSetsParams = {
  deletedTokens: SessionUserToken[];
  prefix: 'token' | 'testToken';
};

export {
  AddTokenParams,
  RemoveTokenParams,
  SubscriptionParams,
  DeleteTokensParams,
  FilterTokensParams,
  CleanTokenSetsParams,
};
