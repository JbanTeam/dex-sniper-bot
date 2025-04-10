import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { Subscription } from './subscription.entity';
import { UpdateSubscriptionParams } from './types';
import { BlockchainService } from '../blockchain/blockchain.service';
import { User } from '@modules/user/user.entity';
import { RedisService } from '@modules/redis/redis.service';
import { Transaction } from '@modules/blockchain/types';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { BotError } from '@src/errors/BotError';
import { Address, Network, SessionSubscription } from '@src/types/types';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
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

  async updateSubscription({ chatId, subscription, action, limit }: UpdateSubscriptionParams) {
    const updatedSubscription = await this.subscriptionRepository.update(subscription.id, { [action]: limit });
    if (!updatedSubscription.affected) {
      throw new BotError('Error updating subscription', 'Ошибка при обновлении подписки', 400);
    }

    subscription[action] = limit;
    const sessionSubscription = { ...subscription, user: undefined };
    delete sessionSubscription.user;
    const subscriptions = await this.redisService.getSubscriptions(chatId);

    if (!subscriptions?.length) {
      throw new BotError('You have no subscriptions', 'Вы не подписаны ни на один кошелек', 404);
    }

    await this.redisService.updateSubscription({
      chatId,
      subscription: sessionSubscription,
      subscriptions,
    });
  }

  async findById({ id }: { id: number }) {
    return await this.subscriptionRepository.findOne({
      where: { id },
    });
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
