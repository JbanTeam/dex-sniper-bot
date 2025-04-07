import { Subscription } from './subscription.entity';

export type UpdateSubscriptionParams = {
  chatId: number;
  subscription: Subscription;
  action: 'buy' | 'sell';
  limit: number;
};
