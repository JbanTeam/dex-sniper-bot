import { SwapLog } from './types';

function isSwapLog(log: unknown): log is SwapLog {
  return (
    typeof log === 'object' &&
    log !== null &&
    'address' in log &&
    'eventName' in log &&
    log.eventName === 'Swap' &&
    'args' in log &&
    typeof log.args === 'object' &&
    log.args !== null &&
    'sender' in log.args &&
    'amount0In' in log.args &&
    'amount1In' in log.args &&
    'amount0Out' in log.args &&
    'amount1Out' in log.args
  );
}

export { isSwapLog };
