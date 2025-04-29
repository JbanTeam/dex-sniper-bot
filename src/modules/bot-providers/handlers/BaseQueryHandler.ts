import { Logger } from '@nestjs/common';

export abstract class BaseQueryHandler<TInput, TOutput> {
  protected readonly logger: Logger;
  constructor(logger: Logger) {
    this.logger = logger;
  }
  abstract handleQuery(query: TInput): Promise<TOutput>;
  abstract addTokenCb(query: TInput): Promise<TOutput>;
  abstract removeTokenCb(query: TInput): Promise<TOutput>;
  abstract subscribeCb(query: TInput): Promise<TOutput>;
  abstract replicateCb(query: TInput): Promise<TOutput>;
  abstract getBalanceCb(query: TInput): Promise<TOutput>;
  abstract sendTokensCb(query: TInput): Promise<TOutput>;
  abstract handleError(error: unknown, errMsg: string, userMsg: string): TOutput;
}
