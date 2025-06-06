export abstract class BaseMessageHandler<TInput, TOutput> {
  abstract handleMessage(message: TInput): Promise<TOutput>;
}
