import { Address } from 'viem';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { User } from '@modules/user/user.entity';
import { Subscription } from './subscription.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { RedisService } from '@modules/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { Transaction } from '@modules/blockchain/viem/types';
import { chains, isChainMonitoring } from '@src/utils/constants';
import { Network, SessionSubscription, UpdateSubscriptionParams } from '@src/types/types';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly blockchainService: BlockchainService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async subscribeToWallet({ chatId, address, network }: { chatId: number; address: Address; network: Network }) {
    const userSession = await this.redisService.getUser(chatId);

    if (!userSession) throw new Error('Пользователь не найден');

    const existingSubscription = userSession.subscriptions.find(s => s.address === address);

    if (existingSubscription) throw new Error('Вы уже подписаны на этот кошелек');

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

    if (!subscriptions?.length) throw new Error('Вы не подписаны ни на один кошелек');

    const sessionSubscription = subscriptions.find(sub => sub.address === walletAddress);
    if (!sessionSubscription) throw new Error('Вы не подписаны на этот кошелек');

    const subscription = await this.subscriptionRepository.findOne({
      where: { id: sessionSubscription.id },
    });

    if (!subscription) throw new Error('Подписка не найдена');
    const deleted = await this.subscriptionRepository.delete({ id: subscription.id });

    if (!deleted.affected) throw new Error('Ошибка при отписке от кошелька');

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
      throw new Error('Вы не подписаны ни на один кошелек');
    }

    const chainsObj = chains(this.configService);
    const groupedSubscriptions = subscriptions.reduce(
      (acc, subscription) => {
        const exchange = chainsObj[subscription.network].exchange;
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
    if (!updatedSubscription.affected) throw new Error('Error updating subscription');

    subscription[action] = limit;
    const sessionSubscription = { ...subscription, user: undefined };
    delete sessionSubscription.user;
    const subscriptions = await this.redisService.getSubscriptions(chatId);

    if (!subscriptions?.length) {
      throw new Error('Вы не подписаны ни на один кошелек');
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

    if (!isChainMonitoring[subscription.network]) {
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
