import { isEthereumAddress } from 'class-validator';
import { Network } from './types';
import { BotError } from '@src/errors/BotError';

function isEtherAddress(address: string, errMsg: string = 'Неверный формат адреса'): asserts address is `0x${string}` {
  if (!address || !isEthereumAddress(address)) throw new BotError('Wrong address', errMsg, 400);
}

function isEtherAddressArr(addresses: string[]): asserts addresses is `0x${string}`[] {
  for (const address of addresses) isEtherAddress(address);
}

function isNetwork(network: string): asserts network is Network {
  const networks = Object.values(Network);
  if (!networks.includes(network as Network)) throw new BotError('Wrong network', 'Неверная сеть', 400);
}

function isNetworkArr(networks: string[]): asserts networks is Network[] {
  for (const network of networks) isNetwork(network);
}

function isBuySell(action: string): asserts action is 'buy' | 'sell' {
  if (!action || (action !== 'buy' && action !== 'sell')) {
    throw new BotError('Wrong command', 'Введите корректную команду. Пример: /replicate buy 100', 400);
  }
}

function isValidRemoveQueryData(network: string): asserts network is Network | 'all' {
  const possibleNetworks: (Network | 'all')[] = Object.values(Network);
  possibleNetworks.push('all');
  if (!possibleNetworks.includes(network as Network | 'all')) {
    throw new BotError(`Invalid query data`, 'Неверные данные запроса', 400);
  }
}

export { isEtherAddress, isEtherAddressArr, isNetwork, isNetworkArr, isBuySell, isValidRemoveQueryData };
