import { ChainableCommander } from 'ioredis';
import { DeleteConditions } from '@modules/user/types';
import { SessionData, SessionReplication, SessionSubscription, SessionUserToken } from '@src/types/types';

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
  userSession: SessionData;
  deleteConditions: DeleteConditions;
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
