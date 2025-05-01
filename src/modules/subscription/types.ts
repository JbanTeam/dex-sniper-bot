import { Address, Network, TempReplication } from '@src/types/types';
import { Subscription } from './subscription.entity';
import { Replication } from './replication.entity';

type SubscribeToWalletParams = { chatId: number; address: Address; network: Network };

type UnsubscribeFromWallwtParams = { chatId: number; walletAddress: Address };

type UpdateSubscriptionParams = {
  chatId: number;
  subscription: Subscription;
  action: 'buy' | 'sell';
  limit: number;
};

type PrepareSessionReplication = {
  replication: Replication;
  tokenAddress: Address;
  tempReplication: TempReplication;
};

export { SubscribeToWalletParams, UnsubscribeFromWallwtParams, UpdateSubscriptionParams, PrepareSessionReplication };
