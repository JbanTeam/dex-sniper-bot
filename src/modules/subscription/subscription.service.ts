import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { Subscription } from './subscription.entity';
import { Replication } from './replication.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { User } from '@modules/user/user.entity';
import { RedisService } from '@modules/redis/redis.service';
import { Transaction } from '@modules/blockchain/types';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { BotError } from '@src/errors/BotError';
import {
  Address,
  Network,
  SessionData,
  SessionReplication,
  SessionSubscription,
  TempReplication,
} from '@src/types/types';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Replication)
    private readonly replicationRepository: Repository<Replication>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly blockchainService: BlockchainService,
    private readonly redisService: RedisService,
    private readonly constants: ConstantsProvider,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async subscribeToWallet({ chatId, address, network }: { chatId: number; address: Address; network: Network }) {
    const userSession = await this.redisService.getUser(chatId);

    if (!userSession) throw new BotError('User not found', 'Пользователь не найден', 404);

    const existingSubscription = userSession.subscriptions.find(s => s.address === address);

    if (existingSubscription) throw new BotError('You are already subscribed', 'Вы уже подписаны на этот кошелек', 400);

    const subscription = this.subscriptionRepository.create({
      user: { id: userSession.userId },
      address,
      network,
    });

    const savedSubscription = await this.subscriptionRepository.save(subscription);
    const sessionSubscription = { ...savedSubscription, user: undefined };
    delete sessionSubscription.user;

    userSession.subscriptions.push(sessionSubscription);

    await this.checkNewAddedSubscription({
      chatId,
      subscription: sessionSubscription,
      subscriptions: userSession.subscriptions,
    });
  }

  async unsubscribeFromWallet({ chatId, walletAddress }: { chatId: number; walletAddress: Address }) {
    const subscriptions = await this.redisService.getSubscriptions(chatId);

    if (!subscriptions?.length)
      throw new BotError('You have no subscriptions', 'Вы не подписаны ни на один кошелек', 404);

    const sessionSubscription = subscriptions.find(sub => sub.address === walletAddress);
    if (!sessionSubscription)
      throw new BotError('You are not subscribed on this wallet', 'Вы не подписаны на этот кошелек', 400);

    const subscription = await this.subscriptionRepository.findOne({
      where: { id: sessionSubscription.id },
    });

    if (!subscription) throw new BotError('Subscription not found', 'Подписка не найдена', 404);
    const deleted = await this.subscriptionRepository.delete({ id: subscription.id });

    if (!deleted.affected) throw new BotError('Error unsubscribing from wallet', 'Ошибка при отписке от кошелька', 400);

    await this.redisService.removeSubscription({
      chatId,
      subscriptions,
      subscription,
    });

    this.eventEmitter.emit('monitorTokens', { network: sessionSubscription.network });
  }

  async getSubscriptions(chatId: number) {
    const subscriptions = await this.redisService.getSubscriptions(chatId);

    if (!subscriptions?.length) {
      throw new BotError('You have no subscriptions', 'Вы не подписаны ни на один кошелек', 404);
    }

    const groupedSubscriptions = subscriptions.reduce(
      (acc, subscription) => {
        const exchange = this.constants.chains[subscription.network].exchange;
        if (!acc[exchange]) {
          acc[exchange] = [];
        }
        acc[exchange].push(subscription);
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

  @OnEvent('handleTransaction')
  async handleTransaction({ tx }: { tx: Transaction | null }) {
    if (!tx) return;

    console.log('transaction', tx);

    // const subscriptions = await this.findSubscriptionsByAddress(tx.to);

    // for (const subscription of subscriptions) {
    //   const user = await this.userRepository.findOne({
    //     where: { id: subscription.user.id },
    //     relations: ['wallets'],
    //   });

    //   if (!user) continue;

    //   const wallet = user.wallets.find(w => w.network === network);
    //   if (!wallet) continue;

    // await this.replicateTransaction(user, wallet, tx);
    // }
  }

  // private async replicateTransaction(user: User, wallet: Wallet, tx: Transaction) {
  //   try {
  //     //Получаем данные о транзакции
  //     const txData = await this.blockchainService.getTransactionData(tx.hash, wallet.network);
  //     //Проверяем, достаточно ли средств на кошельке
  //     const balance = await this.blockchainService.getBalance(wallet.address, wallet.network);
  //     if (balance < tx.value) {
  //       throw new Error('Insufficient funds');
  //     }
  //     //Повторяем транзакцию
  //     const replicatedTxHash = await this.blockchainService.sendTransaction({
  //       from: wallet.address,
  //       to: txData.to,
  //       value: txData.value,
  //       data: txData.data,
  //       network: wallet.network,
  //     });
  //     //Уведомляем пользователя об успешной транзакции
  //     await this.notifyUser(user.chatId, `Transaction replicated: ${replicatedTxHash}`);
  //   } catch (error) {
  //     console.log(error);
  //   }
  // }

  async createOrUpdateReplication(tempReplication: TempReplication) {
    const { action, limit, subscriptionId, tokenId, chatId } = tempReplication;
    if (!chatId || !subscriptionId || !tokenId) {
      throw new BotError('Invalid data', 'Некорректные данные', 400);
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

  async findById(id: number) {
    return await this.subscriptionRepository.findOne({
      where: { id },
    });
  }

  private async createReplication(tempReplication: TempReplication, userSession: SessionData) {
    const { action, limit, network, subscriptionId, tokenId, chatId, userId } = tempReplication;
    if (!chatId || !userId || !subscriptionId || !tokenId) {
      throw new BotError('Invalid data', 'Некорректные данные', 400);
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
      throw new BotError('Replication not found', 'Репликация не найдена', 404);
    }

    const sessionReplication = {
      ...fullReplication,
      tokenAddress: fullReplication.token.address,
      tokenSymbol: fullReplication.token.symbol,
      subscriptionAddress: fullReplication.subscription.address,
      network: fullReplication.subscription.network,
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

  private async updateReplication(existingReplication: SessionReplication, userSession: SessionData) {
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

  private async checkNewAddedSubscription({
    chatId,
    subscription,
    subscriptions,
  }: {
    chatId: number;
    subscription: SessionSubscription;
    subscriptions: SessionSubscription[];
  }): Promise<void> {
    await this.redisService.addSubscription({
      chatId,
      subscription,
      subscriptions,
    });

    if (!this.constants.isChainMonitoring[subscription.network]) {
      this.eventEmitter.emit('monitorTokens', { network: subscription.network });
    }
  }

  private async findByUserId({ userId, address, network }: { userId: number; address: Address; network: Network }) {
    return await this.subscriptionRepository.findOne({
      where: {
        user: { id: userId },
        address,
        network,
      },
    });
  }

  private async findSubscriptionsByAddress(address: Address): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: { address },
      relations: ['user'],
    });
  }
}
