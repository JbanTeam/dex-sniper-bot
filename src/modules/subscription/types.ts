import { Subscription } from './subscription.entity';
import { Address, Network } from '@src/types/types';

type SubscribeToWalletParams = { chatId: number; address: Address; network: Network };

type UnsubscribeFromWalletParams = { chatId: number; walletAddress: Address };

type UpdateSubscriptionParams = {
  chatId: number;
  subscription: Subscription;
  action: 'buy' | 'sell';
  limit: number;
};

export { SubscribeToWalletParams, UnsubscribeFromWalletParams, UpdateSubscriptionParams };
