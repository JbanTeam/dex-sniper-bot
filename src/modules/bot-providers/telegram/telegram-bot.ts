import axios from 'axios';
import { OnEvent } from '@nestjs/event-emitter';
import { HttpStatus, Injectable } from '@nestjs/common';

import { BotError } from '@src/errors/BotError';
import { NOTIFY_USER_EVENT, tgCommands } from '@src/utils/constants';
import { RedisService } from '@modules/redis/redis.service';
import { UserService } from '@modules/user/user.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { TgCommandHandler } from './handlers/TgCommandHandler';
import { TgQueryHandler } from './handlers/TgQueryHandler';
import { TgMessageHandler } from './handlers/TgMessageHandler';
import { Replication } from '@modules/replication/replication.entity';
import { isCallbackQueryUpdate, isMessageUpdate } from './types/typeGuards';
import { BotProviderInterface, IncomingMessage, IncomingQuery, SessionReplication } from '@src/types/types';
import { TgCallbackQuery, TgMessage, TgUpdateResponse, TgSendMsgParams, TgDeleteMsgParams } from './types/types';

@Injectable()
export class TelegramBot implements BotProviderInterface<TgSendMsgParams, TgDeleteMsgParams> {
  private TG_URL: string = 'https://api.telegram.org/bot';
  private stopped = false;
  private offset = 0;
  private retryDelay = 3000;

  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly constants: ConstantsProvider,
    private readonly commandHandler: TgCommandHandler,
    private readonly queryHandler: TgQueryHandler,
    private readonly messageHandler: TgMessageHandler,
  ) {
    const token = this.constants.TELEGRAM_BOT_TOKEN;
    this.TG_URL += token;
  }

  async start(): Promise<void> {
    this.stopped = false;
    await this.setCommands();
    await this.onMessage();
    console.log('Telegram bot started');
  }

  stop(): void {
    this.stopped = true;
    console.log('Telegram bot stopped');
  }

  async sendMessage({ chatId, text, options = {} }: TgSendMsgParams): Promise<void> {
    const url = `${this.TG_URL}/sendMessage`;

    try {
      await axios.post(url, {
        chat_id: chatId,
        text: text,
        parse_mode: options.parse_mode || 'html',
        ...options,
      });
    } catch (error) {
      console.log('Error while sending message:', error);
    }
  }

  async deleteMessage({ chatId, messageId }: TgDeleteMsgParams): Promise<void> {
    try {
      const url = `${this.TG_URL}/deleteMessage`;
      await axios.post(url, {
        chat_id: chatId,
        message_id: messageId,
      });
    } catch (error) {
      console.log('Error while deleting message:', error);
    }
  }

  async onMessage(): Promise<void> {
    while (!this.stopped) {
      try {
        const url = `${this.TG_URL}/getUpdates?offset=${this.offset}&allowed_updates=["message", "callback_query"]`;
        const response = await axios.get(url);
        const data: TgUpdateResponse = response.data as TgUpdateResponse;

        if (data.ok && data.result.length > 0) {
          for (const update of data.result) {
            if (this.stopped) return;

            if (update.message) {
              const message = this.parseMessage(update.message);
              await this.setSession(update.message);
              await this.handleIncomingMessage(message);
            } else if (update.callback_query) {
              const query = this.parseQuery(update.callback_query);
              await this.setSession(update.callback_query);
              await this.handleIncomingMessage(query);
            }

            this.offset = update.update_id + 1;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error while getting updates: ${message}`);

        if (this.stopped) return;

        console.log(`Retrying in ${this.retryDelay / 1000} seconds...`);
        await new Promise(res => setTimeout(res, this.retryDelay));
      }
    }
  }

  @OnEvent(NOTIFY_USER_EVENT)
  async notifyUser({ chatId, text }: { chatId: number; text: string }): Promise<void> {
    try {
      await this.sendMessage({ chatId, text });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error notifying user: ${message}`);
    }
  }

  private async setCommands(): Promise<void> {
    const url = `${this.TG_URL}/setMyCommands`;

    const body = {
      commands: tgCommands,
      scope: { type: 'all_private_chats' },
      language_code: 'ru',
    };

    try {
      const response = await axios.post(url, body);

      if (!response.data.ok) {
        throw new BotError('Failed to set commands', 'Не удалось установить команды', HttpStatus.BAD_REQUEST);
      }

      console.log('Commands set successfully:', response.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error setting commands: ${message}`);
    }
  }

  private async handleIncomingMessage(message: IncomingMessage | IncomingQuery): Promise<void> {
    const response = await this.routeMessage(message);

    if ('data' in message) {
      await this.deleteMessage({ chatId: message.chatId, messageId: message.messageId });
    }

    await this.sendMessage({ chatId: message.chatId, ...response });
  }

  private async routeMessage(message: IncomingMessage | IncomingQuery) {
    if ('data' in message) {
      return this.queryHandler.handleQuery(message);
    }

    return message.text.startsWith('/')
      ? this.commandHandler.handleCommand(message)
      : this.messageHandler.handleMessage(message);
  }

  private async setSession(update: TgMessage | TgCallbackQuery): Promise<void> {
    try {
      const { chatId } = this.checkUpdate(update);

      const userExists = await this.redisService.existsInSet('users', chatId.toString());

      if (userExists) {
        await this.redisService.setUserField(chatId, 'action', 'get');
        return;
      }

      const { user, action } = await this.userService.getOrCreateUser(chatId);

      if (!user) throw new BotError('User not found', 'Пользователь не найден', HttpStatus.NOT_FOUND);

      await this.redisService.addUser({
        chatId,
        userId: user.id,
        action,
        wallets: [...user.wallets],
        tokens: [...user.tokens],
        subscriptions: [...user.subscriptions],
        replications: this.mapReplications(user.replications, chatId),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error setting session: ${message}`);
    }
  }

  private mapReplications(replications: Replication[], chatId: number): SessionReplication[] {
    return replications.map(replication => {
      return {
        id: replication.id,
        network: replication.network,
        buy: replication.buy,
        sell: replication.sell,
        tokenId: replication.token.id,
        tokenSymbol: replication.token.symbol,
        tokenAddress: replication.token.address,
        tokenDecimals: replication.token.decimals,
        subscriptionId: replication.subscription.id,
        subscriptionAddress: replication.subscription.address,
        chatId,
        userId: replication.user.id,
      };
    });
  }

  private checkUpdate(update: TgMessage | TgCallbackQuery): { chatId: number } {
    if (isMessageUpdate(update)) {
      return {
        chatId: update.chat.id,
      };
    } else if (isCallbackQueryUpdate(update)) {
      return {
        chatId: update.message?.chat.id || 0,
      };
    } else {
      throw new BotError('Unknown update type', 'Ошибка при обработке обновления', HttpStatus.BAD_REQUEST);
    }
  }

  private parseMessage(message: TgMessage): IncomingMessage {
    return {
      chatId: message.chat.id,
      text: message.text || '',
      messageId: message.message_id,
      timestamp: new Date(message.date * 1000),
      user: {
        id: message.from?.id || 0,
        username: message.from?.username,
      },
    };
  }

  private parseQuery(query: TgCallbackQuery): IncomingQuery {
    return {
      query_id: query.id,
      chatId: query?.message?.chat.id || 0,
      data: query.data || '',
      messageId: query.message?.message_id || 0,
      timestamp: query.message?.date ? new Date(query?.message?.date * 1000) : new Date(),
      user: {
        id: query.message?.from?.id || 0,
        username: query.message?.from?.username || '',
      },
    };
  }
}
