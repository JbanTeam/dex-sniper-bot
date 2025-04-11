import { Logger } from '@nestjs/common';

export abstract class BaseCommandHandler<TInput, TOutput> {
  protected readonly logger: Logger;
  constructor(logger: Logger) {
    this.logger = logger;
  }
  abstract handleCommand(message: TInput): Promise<TOutput>;
  abstract addToken(message: TInput): Promise<TOutput>;
  abstract removeToken(message: TInput): Promise<TOutput>;
  abstract getTokens(message: TInput): Promise<TOutput>;
  abstract subscribe(message: TInput): Promise<TOutput>;
  abstract unsubscribe(message: TInput): Promise<TOutput>;
  abstract getSubscriptions(message: TInput): Promise<TOutput>;
  abstract replicate(message: TInput): Promise<TOutput>;
  abstract getBalance(message: TInput): Promise<TOutput>;
  abstract sendTokens(message: TInput): Promise<TOutput>;
  abstract handleError(error: unknown, errMsg: string, userMsg: string): TOutput;
}
