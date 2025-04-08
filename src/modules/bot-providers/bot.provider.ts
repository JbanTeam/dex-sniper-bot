// import { Injectable } from '@nestjs/common';
import { MessageHandler } from './telegram/handlers/message-handler';
import { CommandHandler } from './telegram/handlers/command-handler';
import { QueryHandler } from './telegram/handlers/query-handler';
import { BotProviderInterface, IncomingMessage, IncomingQuery, SendMessageOptions } from '@src/types/types';

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
      await this.handleIncomingMessage(message);
    });
  }

  private async handleIncomingMessage(message: IncomingMessage | IncomingQuery): Promise<void> {
    const response = await this.routeMessage(message);
    if ('data' in message) {
      await this.deleteMessage(message.chatId, message.messageId);
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
}
