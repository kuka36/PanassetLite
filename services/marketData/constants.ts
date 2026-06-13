import { APIThrottler } from '../../utils/throttler';

export const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD';
export const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price';
export const COINGECKO_HISTORY_API = 'https://api.coingecko.com/api/v3/coins';

export const CACHE_RATES_KEY = 'panasset_rates';
export const CACHE_CRYPTO_KEY = 'panasset_crypto_prices';
export const CACHE_STOCKS_KEY = 'panasset_stock_prices';
export const CACHE_HISTORY_KEY = 'panasset_asset_history';
export const CACHE_FAILURES_KEY = 'panasset_api_failures';

export const RATES_TTL = 24 * 3600 * 1000;
export const CRYPTO_TTL = 10 * 60 * 1000;
export const STOCK_TTL = 45 * 60 * 1000;
export const HISTORY_TTL = 24 * 3600 * 1000;
export const FAILURE_TTL = 30 * 60 * 1000;

export const CRYPTO_MAP: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'SOL': 'solana',
  'BNB': 'binancecoin',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'DOT': 'polkadot',
  'MATIC': 'matic-network',
  'LINK': 'chainlink'
};

export const KNOWN_MANUAL_SYMBOLS = [
  'ARBITRAGE_NEW_USER',
  'CSI300ETF_C',
  'ZHOUZHOUBAO_FUND'
];

// Alpha Vantage: 5 requests per minute. Window set to 65s for safety.
export const avThrottler = new APIThrottler(2000, 5, 65000);
// CoinGecko: 1 request per 1.5s to avoid 429
export const cgThrottler = new APIThrottler(1500);
// Finnhub: generous limit (~3/sec)
export const finnhubThrottler = new APIThrottler(300);

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
