export const SPOT_PAIRS = [
  'BTC-USDT',
  'ETH-USDT',
  'SOL-USDT',
  'TRX-USDT',
  'XRP-USDT',
] as const;

export type SpotPair = typeof SPOT_PAIRS[number];

export const SPOT_CURRENCIES = [
  'USDT',
  'BTC',
  'ETH',
  'SOL',
  'TRX',
  'XRP',
] as const;
