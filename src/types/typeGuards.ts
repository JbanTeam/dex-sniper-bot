import { isEthereumAddress } from 'class-validator';
import { Network } from './types';

function isEtherAddress(address: string, errMsg: string = 'Неверный формат адреса'): asserts address is `0x${string}` {
  if (!address || !isEthereumAddress(address)) throw new Error(errMsg);
}

function isEtherAddressArr(addresses: string[]): asserts addresses is `0x${string}`[] {
  for (const address of addresses) isEtherAddress(address);
}

function isNetwork(network: string): asserts network is Network {
  const networks = Object.values(Network);
  if (!networks.includes(network as Network)) throw new Error('Неверная сеть');
}

function isNetworkArr(networks: string[]): asserts networks is Network[] {
  for (const network of networks) isNetwork(network);
}

function isValidRemoveQueryData(network: string): asserts network is Network | 'all' {
  const possibleNetworks: (Network | 'all')[] = Object.values(Network);
  possibleNetworks.push('all');
  if (!possibleNetworks.includes(network as Network | 'all')) {
    throw new Error(`Invalid query data`);
  }
}

export { isEtherAddress, isEtherAddressArr, isNetwork, isNetworkArr, isValidRemoveQueryData };
