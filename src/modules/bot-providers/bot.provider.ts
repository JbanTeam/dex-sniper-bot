// import { Injectable } from '@nestjs/common';
import { MessageHandler } from './telegram/handlers/message-handler';
import { CommandHandler } from './telegram/handlers/command-handler';
import { BotProviderInterface, IncomingMessage, IncomingQuery, SendMessageOptions } from '@src/types/types';
import { QueryHandler } from './telegram/handlers/query-handler';

export class BotProvider {
  constructor(
    private readonly provider: BotProviderInterface,
    private readonly messageHandler: MessageHandler,
    private readonly commandHandler: CommandHandler,
    private readonly queryHandler: QueryHandler,
  ) {}

  async sendMessage({
    chatId,
    text,
    options,
  }: {
    chatId: number;
    text: string;
    options?: SendMessageOptions;
  }): Promise<void> {
    await this.provider.sendMessage({ chatId, text, options });
  }

  async deleteMessage(chatId: number, messageId: number): Promise<void> {
    await this.provider.deleteMessage({ chatId, messageId });
  }

  async start(): Promise<void> {
    await this.provider.onMessage(async (message: IncomingMessage | IncomingQuery) => {
      let response: { text: string; options?: SendMessageOptions };
      if ('data' in message) {
        response = await this.queryHandler.handleQuery(message);
        await this.deleteMessage(message.chatId, message.messageId);
      } else {
        if (message.text.startsWith('/')) {
          response = await this.commandHandler.handleCommand(message);
        } else {
          response = await this.messageHandler.handleMessage(message);
        }
      }

      await this.sendMessage({ chatId: message.chatId, ...response });
    });
  }
}
