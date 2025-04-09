export abstract class BaseQueryHandler<TInput, TOutput> {
  abstract handleQuery(query: TInput): Promise<TOutput>;
  abstract addTokenCb(query: TInput): Promise<TOutput>;
  abstract removeTokenCb(query: TInput): Promise<TOutput>;
  abstract subscribeCb(query: TInput): Promise<TOutput>;
  abstract replicateCb(query: TInput): Promise<TOutput>;
  abstract getBalanceCb(query: TInput): Promise<TOutput>;
  abstract sendTokensCb(query: TInput): Promise<TOutput>;
}
