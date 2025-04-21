import { SwapLog } from './types';

function isSwapLog(log: unknown): log is SwapLog {
  return (
    typeof log === 'object' &&
    log !== null &&
    'eventName' in log &&
    log.eventName === 'Swap' &&
    'args' in log &&
    typeof log.args === 'object' &&
    log.args !== null &&
    'sender' in log.args &&
    'amountIn' in log.args &&
    'amountOut' in log.args &&
    'tokenIn' in log.args &&
    'tokenOut' in log.args
  );
}

export { isSwapLog };
