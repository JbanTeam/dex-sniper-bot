// import { Injectable } from '@nestjs/common';
import { MessageHandler } from './utils/message-handler';
import { CommandHandler } from './utils/command-handler';
import { BotProviderInterface, IncomingMessage } from '@src/types/types';

export class BotProvider {
  constructor(
    private readonly provider: BotProviderInterface,
    private readonly messageHandler: MessageHandler,
    private readonly commandHandler: CommandHandler,
  ) {}

  async sendMessage(chatId: number, text: string): Promise<void> {
    await this.provider.sendMessage(chatId, text);
  }

  async start(): Promise<void> {
    await this.provider.onMessage(async (message: IncomingMessage) => {
      let response: string = '';
      if (message.text.startsWith('/')) {
        response = await this.commandHandler.handleCommand(message.text);
      } else {
        response = await this.messageHandler.handleMessage(message.text);
      }

      await this.sendMessage(message.chatId, response);
    });
  }
}
