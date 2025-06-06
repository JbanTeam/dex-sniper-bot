import { LOG_ADDRESS_LENGTH } from '@src/constants';

function strIsPositiveNumber(value: string) {
  return /^\d+$/.test(value);
}

function decodeLogAddress(topic: `0x${string}`): `0x${string}` {
  return `0x${topic.slice(LOG_ADDRESS_LENGTH)}`;
}

export { strIsPositiveNumber, decodeLogAddress };
