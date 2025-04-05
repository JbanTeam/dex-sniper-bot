function strIsPositiveNumber(value: string) {
  return /^\d+$/.test(value);
}

function decodeLogAddress(topic: `0x${string}`): `0x${string}` {
  return `0x${topic.slice(26)}`;
}

export { strIsPositiveNumber, decodeLogAddress };
