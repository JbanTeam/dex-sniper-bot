import { Repository } from 'typeorm';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Replication } from './replication.entity';
import { PrepareSessionReplication } from './types';
import { BotError } from '@src/errors/BotError';
import { RedisService } from '@modules/redis/redis.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { SessionReplication, SessionUser, TempReplication } from '@src/types/types';

@Injectable()
export class ReplicationService {
  constructor(
    @InjectRepository(Replication)
    private readonly replicationRepository: Repository<Replication>,
    private readonly redisService: RedisService,
    private readonly constants: ConstantsProvider,
  ) {}

  async getReplications(chatId: number): Promise<string> {
    const replicatons = await this.redisService.getReplications(chatId);

    if (!replicatons?.length) {
      throw new BotError('You have no replicatons', 'Вы не устанавливали повтор сделок', HttpStatus.NOT_FOUND);
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

    let reply = '<u>Ваши параметры повторов сделок:</u>\n\n';
    Object.entries(groupedReplications).forEach(([exchange, reps]) => {
      reply += `<u>${exchange}:</u>\n`;
      reps.forEach((rep, index) => {
        reply += `<b>${index + 1}. 💰 Кошелек:</b> <code>${rep.subscriptionAddress}</code>\n`;
        reply += `<b>${rep.tokenSymbol}:</b> <code>${rep.tokenAddress}</code>\n`;
        reply += `<b>Лимиты:</b> покупка - ${rep.buy}; продажа - ${rep.sell}\n`;
      });
      reply += '\n';
    });

    return reply;
  }

  async createOrUpdateReplication(tempReplication: TempReplication): Promise<string> {
    const { action, limit, subscriptionId, tokenId, chatId } = tempReplication;
    if (!chatId || !subscriptionId || !tokenId) {
      throw new BotError(
        'Invalid data in tempReplication',
        'Не удалось установить повтор сделок',
        HttpStatus.BAD_REQUEST,
      );
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

  private async createReplication(tempReplication: TempReplication, userSession: SessionUser): Promise<string> {
    const { action, limit, network, subscriptionId, tokenId, chatId, userId } = tempReplication;
    if (!chatId || !userId || !subscriptionId || !tokenId) {
      throw new BotError(
        'Invalid data in tempReplication',
        'Не удалось установить повтор сделок',
        HttpStatus.BAD_REQUEST,
      );
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
      throw new BotError('Replication not found', 'Не удалось установить повтор сделок', HttpStatus.NOT_FOUND);
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
      throw new BotError(
        'Invalid data in tempReplication',
        'Не удалось установить повтор сделок',
        HttpStatus.BAD_REQUEST,
      );
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
      throw new BotError('Error updating replication', 'Не удалось установить повтор сделок', HttpStatus.BAD_REQUEST);
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
