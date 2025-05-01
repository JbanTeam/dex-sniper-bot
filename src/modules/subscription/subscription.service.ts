import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';

import { Subscription } from './subscription.entity';
import { Replication } from './replication.entity';
import { RedisService } from '@modules/redis/redis.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { BotError } from '@src/errors/BotError';
import { PrepareSessionReplication, SubscribeToWalletParams, UnsubscribeFromWallwtParams } from './types';
import { Address, SessionUser, SessionReplication, SessionSubscription, TempReplication } from '@src/types/types';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Replication)
    private readonly replicationRepository: Repository<Replication>,
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

  async unsubscribeFromWallet({ chatId, walletAddress }: UnsubscribeFromWallwtParams): Promise<void> {
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

    let reply = '';
    Object.entries(groupedSubscriptions).forEach(([exchange, subs]) => {
      reply += `<u><b>${exchange}:</b></u>\n`;
      subs.forEach((sub, index) => {
        reply += `${index + 1}. <code>${sub.address}</code>\n`;
      });
      reply += '\n';
    });

    return reply;
  }

  async getReplications(chatId: number): Promise<string> {
    const replicatons = await this.redisService.getReplications(chatId);

    if (!replicatons?.length) {
      throw new BotError('You have no replicatons', 'Вы не устанавливали повтор сделок', 404);
    }

    const groupedReplications = replicatons.reduce(
      (acc, rep) => {
        const exchange = this.constants.chains[rep.network].exchange;
        const key = `${exchange} (${rep.network})`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(rep);
        return acc;
      },
      {} as Record<string, SessionReplication[]>,
    );

    let reply = '';
    Object.entries(groupedReplications).forEach(([exchange, reps]) => {
      reply += `<u><b>${exchange}:</b></u>\n`;
      reps.forEach((rep, index) => {
        reply += `<b>${index + 1}. Кошелек:</b> <code>${rep.subscriptionAddress}</code>\n`;
        reply += `<b>${rep.tokenSymbol}:</b> <code>${rep.tokenAddress}</code>\n`;
        reply += `<b>Лимиты:</b> покупка - ${rep.buy}; продажа - ${rep.sell}\n`;
      });
      reply += '\n\n';
    });

    return reply;
  }

  async createOrUpdateReplication(tempReplication: TempReplication): Promise<string> {
    const { action, limit, subscriptionId, tokenId, chatId } = tempReplication;
    if (!chatId || !subscriptionId || !tokenId) {
      throw new BotError('Invalid data in tempReplication', 'Не удалось установить повтор сделок', 400);
    }
    const userSession = await this.redisService.getUser(chatId);

    const existingReplication = userSession.replications.find(
      repl => repl.tokenId === tokenId && repl.subscriptionId === subscriptionId,
    );

    if (existingReplication) {
      existingReplication[action] = limit;
      return await this.updateReplication(existingReplication, userSession);
    }

    return await this.createReplication(tempReplication, userSession);
  }

  async findById(id: number): Promise<Subscription | null> {
    return await this.subscriptionRepository.findOne({
      where: { id },
    });
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

  private async createReplication(tempReplication: TempReplication, userSession: SessionUser): Promise<string> {
    const { action, limit, network, subscriptionId, tokenId, chatId, userId } = tempReplication;
    if (!chatId || !userId || !subscriptionId || !tokenId) {
      throw new BotError('Invalid data in tempReplication', 'Не удалось установить повтор сделок', 400);
    }

    const replicationData = {
      [action]: limit,
      network,
      token: { id: tokenId },
      subscription: { id: subscriptionId },
      user: { id: userId },
    };

    const replication = this.replicationRepository.create(replicationData);
    await this.replicationRepository.save(replication);
    const fullReplication = await this.replicationRepository.findOne({
      where: { id: replication.id },
      relations: ['token', 'subscription', 'user'],
    });

    if (!fullReplication) {
      throw new BotError('Replication not found', 'Не удалось установить повтор сделок', 404);
    }

    let tokenAddress = fullReplication.token.address;

    if (this.constants.notProd) {
      const testToken = userSession.testTokens?.find(t => t.id === tokenId);
      tokenAddress = testToken?.address || fullReplication.token.address;
    }

    const sessionReplication = this.prepareSessionReplicateion({
      replication: fullReplication,
      tokenAddress,
      tempReplication,
    });

    userSession.replications.push(sessionReplication);
    await this.redisService.setUserField(chatId, 'replications', JSON.stringify(userSession.replications));

    let reply = '';
    const token = userSession.tokens.find(t => t.id === tokenId);
    const subscription = userSession.subscriptions.find(s => s.id === subscriptionId);

    reply += `<u>Кошелек:</u> <b>${subscription?.network}</b> <code>${subscription?.address}</code>\n`;
    reply += `<u>Токен:</u> <b>${token?.name} (${token?.symbol})</b>\n`;
    reply += `<u>Лимит на покупку:</u> <b>${sessionReplication.buy}</b>\n`;
    reply += `<u>Лимит на продажу:</u> <b>${sessionReplication.sell}</b>\n`;

    return reply;
  }

  private prepareSessionReplicateion({
    replication,
    tokenAddress,
    tempReplication,
  }: PrepareSessionReplication): SessionReplication {
    const { subscriptionId, tokenId, chatId, userId } = tempReplication;
    if (!chatId || !userId || !subscriptionId || !tokenId) {
      throw new BotError('Invalid data in tempReplication', 'Не удалось установить повтор сделок', 400);
    }
    const sessionReplication = {
      ...replication,
      tokenAddress,
      tokenSymbol: replication.token.symbol,
      tokenDecimals: replication.token.decimals,
      subscriptionAddress: replication.subscription.address,
      network: replication.subscription.network,
      tokenId,
      subscriptionId,
      chatId,
      userId,
      user: undefined,
      token: undefined,
      subscription: undefined,
    };
    delete sessionReplication.token;
    delete sessionReplication.subscription;
    delete sessionReplication.user;

    return sessionReplication;
  }

  private async updateReplication(existingReplication: SessionReplication, userSession: SessionUser): Promise<string> {
    const { buy, sell, chatId } = existingReplication;
    const updatedReplication = await this.replicationRepository.update(existingReplication.id, { buy, sell });
    if (!updatedReplication.affected) {
      throw new BotError('Error updating replication', 'Не удалось установить повтор сделок', 400);
    }

    userSession.replications = userSession.replications.filter(r => r.id !== existingReplication.id);
    userSession.replications.push(existingReplication);
    await this.redisService.setUserField(chatId, 'replications', JSON.stringify(userSession.replications));

    let reply = '';
    const token = userSession.tokens.find(t => t.id === existingReplication.tokenId);
    const subscription = userSession.subscriptions.find(s => s.id === existingReplication.subscriptionId);

    reply += `<u>Кошелек:</u> <b>${subscription?.network}</b> <code>${subscription?.address}</code>\n`;
    reply += `<u>Токен:</u> <b>${token?.name} (${token?.symbol})</b>\n`;
    reply += `<u>Лимит на покупку:</u> <b>${existingReplication.buy}</b>\n`;
    reply += `<u>Лимит на продажу:</u> <b>${existingReplication.sell}</b>\n`;

    return reply;
  }
}
