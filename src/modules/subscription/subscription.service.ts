import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';

import { RedisService } from '@modules/redis/redis.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { BotError } from '@src/errors/BotError';
import { SubscribeToWalletParams, UnsubscribeFromWalletParams } from './types';
import { Address, SessionSubscription } from '@src/types/types';
import { Subscription } from './subscription.entity';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly redisService: RedisService,
    private readonly constants: ConstantsProvider,
  ) {}

  async subscribeToWallet({ chatId, address, network }: SubscribeToWalletParams): Promise<void> {
    const userSession = await this.redisService.getUser(chatId);

    const existingSubscription = userSession.subscriptions.find(s => s.address === address);
    if (existingSubscription) throw new BotError('You are already subscribed', 'Вы уже подписаны на этот кошелек', 400);
    const isSubscribeOnOwnWallet = userSession.wallets.find(w => w.address.toLowerCase() === address);
    if (isSubscribeOnOwnWallet) {
      throw new BotError('Subscribing on own wallet', 'Вы не можете подписаться на свой кошелек', 400);
    }

    const subscription = this.subscriptionRepository.create({
      user: { id: userSession.userId },
      address,
      network,
    });

    const savedSubscription = await this.subscriptionRepository.save(subscription);
    const sessionSubscription = { ...savedSubscription, user: undefined };
    delete sessionSubscription.user;

    userSession.subscriptions.push(sessionSubscription);

    await this.redisService.addSubscription({
      chatId,
      subscription: sessionSubscription,
      subscriptions: userSession.subscriptions,
    });
  }

  async unsubscribeFromWallet({ chatId, walletAddress }: UnsubscribeFromWalletParams): Promise<void> {
    const userSession = await this.redisService.getUser(chatId);

    if (!userSession.subscriptions?.length) {
      throw new BotError('You have no subscriptions', 'Вы не подписаны ни на один кошелек', 404);
    }

    const sessionSubscription = userSession.subscriptions.find(sub => sub.address === walletAddress);
    if (!sessionSubscription) {
      throw new BotError('You are not subscribed on this wallet', 'Вы не подписаны на этот кошелек', 400);
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: { id: sessionSubscription.id },
    });

    if (!subscription) throw new BotError('Subscription not found', 'Подписка не найдена', 404);
    const deleted = await this.subscriptionRepository.delete({ id: subscription.id });

    if (!deleted.affected) throw new BotError('Error unsubscribing from wallet', 'Ошибка при отписке от кошелька', 400);

    await this.redisService.removeSubscription({
      chatId,
      subscriptions: userSession.subscriptions,
      replications: userSession.replications,
      subscription: sessionSubscription,
    });
  }

  async getSubscriptions(chatId: number): Promise<string> {
    const subscriptions = await this.redisService.getSubscriptions(chatId);

    if (!subscriptions?.length) {
      throw new BotError('You have no subscriptions', 'Вы не подписаны ни на один кошелек', 404);
    }

    const groupedSubscriptions = subscriptions.reduce(
      (acc, subscription) => {
        const exchange = this.constants.chains[subscription.network].exchange;
        const key = `${exchange} (${subscription.network})`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(subscription);
        return acc;
      },
      {} as Record<string, SessionSubscription[]>,
    );

    let reply = '<b>Ваши подписки:</b>\n';
    Object.entries(groupedSubscriptions).forEach(([exchange, subs]) => {
      reply += `<u><b>${exchange}:</b></u>\n`;
      subs.forEach((sub, index) => {
        reply += `${index + 1}. <code>${sub.address}</code>\n`;
      });
      reply += '\n';
    });

    return reply;
  }

  async findSubscriptionsByAddress(address: Address): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: { address },
      relations: ['user', 'user.wallets'],
      select: {
        id: true,
        address: true,
        network: true,
        user: {
          chatId: true,
          wallets: {
            address: true,
            network: true,
            encryptedPrivateKey: true,
          },
        },
      },
    });
  }

  async findById(id: number): Promise<Subscription | null> {
    return await this.subscriptionRepository.findOne({
      where: { id },
    });
  }
}
