import { IncomingMessage, IncomingQuery } from '@src/types/types';

export class BotError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
    public readonly statusCode: number,
    public incomingMessage?: IncomingMessage | IncomingQuery,
  ) {
    super(message);
    this.name = 'BotError';
  }
}
