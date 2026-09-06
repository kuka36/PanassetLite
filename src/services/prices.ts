import type { Asset, PriceHistory, Settings } from '../types'
import { today } from './storage'

/**
 * PriceService — 行情与汇率。
 * 渐进增强:不配置任何 key 也能用(加密货币优先 Gate.io，失败时 CoinGecko；汇率 Frankfurter);
 * 配置 Finnhub key 后可自动更新美股行情;其余资产手动估值。
 */

export interface PriceUpdateResult {
  updated: string[]
  failed: string[]
}

export interface SuggestCryptoUnitPriceResult {
  /** 资产计价货币下的建议单价；无法取得时为 undefined */
  price?: number
  prices: PriceHistory
  /** 本次是否新拉取并写入了 prices */
  fetched: boolean
}

/** CoinGecko id → Gate.io 现货 base（对 USDT） */
const COINGECKO_TO_GATE_BASE: Record<string, string> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  tether: 'USDT',
  binancecoin: 'BNB',
  solana: 'SOL',
  ripple: 'XRP',
  cardano: 'ADA',
  dogecoin: 'DOGE',
  'usd-coin': 'USDC',
  tron: 'TRX',
  polkadot: 'DOT',
  'avalanche-2': 'AVAX',
  'matic-network': 'MATIC',
  'polygon-ecosystem-token': 'POL',
  chainlink: 'LINK',
  litecoin: 'LTC',
  'bitcoin-cash': 'BCH',
  'shiba-inu': 'SHIB',
  uniswap: 'UNI',
  near: 'NEAR',
  aptos: 'APT',
  sui: 'SUI',
  pepe: 'PEPE',
  stellar: 'XLM',
  cosmos: 'ATOM',
  filecoin: 'FIL',
  arbitrum: 'ARB',
  optimism: 'OP',
  'the-open-network': 'TON',
}

function gateBaseFromCoinId(coinId: string): string | undefined {
  const id = coinId.toLowerCase()
  if (COINGECKO_TO_GATE_BASE[id]) return COINGECKO_TO_GATE_BASE[id]
  // 已是交易所 ticker（如 BTC、ETH）
  if (/^[a-zA-Z0-9]{2,10}$/.test(coinId) && !id.includes('-')) return coinId.toUpperCase()
  return undefined
}

function usdtCnyRate(settings: Settings): number | undefined {
  const r = settings.fxRates.USDT ?? settings.fxRates.USD
  return r != null && r > 0 ? r : undefined
}

/** Gate.io 现货 last；公开接口带 CORS，浏览器可直连 */
async function fetchGateLast(base: string, signal?: AbortSignal): Promise<number | undefined> {
  const pair = `${base}_USDT`
  const url = `https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${encodeURIComponent(pair)}`
  const res = await fetch(url, {
    signal: signal ?? AbortSignal.timeout(8000),
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return undefined
  const data: Array<{ last?: string }> = await res.json()
  const last = Number(data[0]?.last)
  return last > 0 ? last : undefined
}

/** CoinGecko 单币种 CNY 价；失败返回 undefined */
async function fetchCoinGeckoCny(
  coinId: string,
  signal?: AbortSignal,
): Promise<number | undefined> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=cny`
  const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(8000) })
  if (!res.ok) return undefined
  const data: Record<string, { cny?: number }> = await res.json()
  const price = data[coinId]?.cny
  return price && price > 0 ? price : undefined
}

/** Gate.io：现货 USDT 价 × 设置中 USDT→CNY（稳定币直接取汇率） */
async function fetchGateCny(
  coinId: string,
  settings: Settings,
  signal?: AbortSignal,
): Promise<number | undefined> {
  const base = gateBaseFromCoinId(coinId)
  if (!base) return undefined
  const usdtCny = usdtCnyRate(settings)
  if (usdtCny == null) return undefined
  if (base === 'USDT' || base === 'USDC') return usdtCny
  const last = await fetchGateLast(base, signal)
  if (last == null) return undefined
  return last * usdtCny
}

/** 主线路 Gate.io → 备用 CoinGecko */
async function fetchCryptoCnyPrice(
  coinId: string,
  settings: Settings,
  signal?: AbortSignal,
): Promise<number | undefined> {
  try {
    const gate = await fetchGateCny(coinId, settings, signal)
    if (gate != null) return gate
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
  }
  return fetchCoinGeckoCny(coinId, signal)
}

/**
 * 为记买入/卖出建议原币单价：本地业务日行情 → 今日则联网拉取并写入 prices。
 * 仅 priceSource=coingecko 且有 symbol；行情表存 CNY，再按资产币种折算。
 */
export async function suggestCryptoUnitPrice(
  asset: Asset,
  dateKey: string,
  prices: PriceHistory,
  settings: Settings,
  signal?: AbortSignal,
): Promise<SuggestCryptoUnitPriceResult> {
  if (asset.priceSource !== 'coingecko' || !asset.symbol) {
    return { prices, fetched: false }
  }
  const id = asset.symbol.toLowerCase()
  let next = prices
  let fetched = false
  let cny = next[id]?.[dateKey]

  if (!(cny != null && cny > 0) && dateKey === today()) {
    const live = await fetchCryptoCnyPrice(id, settings, signal)
    if (live != null) {
      next = { ...prices, [id]: { ...(prices[id] ?? {}), [dateKey]: live } }
      cny = live
      fetched = true
    }
  }

  if (!(cny != null && cny > 0)) return { prices: next, fetched }

  let unit = cny
  if (asset.currency !== settings.baseCurrency) {
    const fx = settings.fxRates[asset.currency]
    if (!(fx != null && fx > 0)) return { prices: next, fetched }
    unit = cny / fx
  }
  return { price: unit, prices: next, fetched }
}

/** 加密货币:优先 Gate.io，失败则 CoinGecko */
export async function fetchCryptoPrices(
  assets: Asset[],
  prices: PriceHistory,
  settings: Settings,
): Promise<PriceUpdateResult> {
  const ids = [
    ...new Set(
      assets
        .filter((a) => !a.archived && a.priceSource === 'coingecko' && a.symbol)
        .map((a) => a.symbol!.toLowerCase()),
    ),
  ]
  if (ids.length === 0) return { updated: [], failed: [] }

  const d = today()
  const resolved: Record<string, number> = {}

  await Promise.all(
    ids.map(async (id) => {
      try {
        const gate = await fetchGateCny(id, settings)
        if (gate != null) resolved[id] = gate
      } catch {
        /* 下一批走 CoinGecko */
      }
    }),
  )

  const needGecko = ids.filter((id) => !(resolved[id] > 0))
  if (needGecko.length > 0) {
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${needGecko.join(',')}&vs_currencies=cny`
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (res.ok) {
        const data: Record<string, { cny?: number }> = await res.json()
        for (const id of needGecko) {
          const price = data[id]?.cny
          if (price && price > 0) resolved[id] = price
        }
      }
    } catch {
      /* 无第三备用 */
    }
  }

  const updated: string[] = []
  const failed: string[] = []
  for (const id of ids) {
    const price = resolved[id]
    if (price != null && price > 0) {
      prices[id] = { ...(prices[id] ?? {}), [d]: price }
      updated.push(id)
    } else {
      failed.push(id)
    }
  }
  return { updated, failed }
}

/** 美股等:Finnhub(需免费 API key),按资产币种换算为 CNY 入库 */
export async function fetchStockPrices(
  assets: Asset[],
  prices: PriceHistory,
  settings: Settings,
): Promise<PriceUpdateResult> {
  const targets = assets.filter(
    (a) => !a.archived && a.priceSource === 'finnhub' && a.symbol,
  )
  if (targets.length === 0) return { updated: [], failed: [] }
  if (!settings.finnhubKey) throw new Error('未配置 Finnhub API key(设置页可添加)')

  const updated: string[] = []
  const failed: string[] = []
  const d = today()
  for (const asset of targets) {
    try {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(asset.symbol!)}&token=${settings.finnhubKey}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(String(res.status))
      const data: { c?: number } = await res.json()
      if (data.c && data.c > 0) {
        const fx =
          asset.currency === settings.baseCurrency
            ? 1
            : (settings.fxRates[asset.currency] ?? 1)
        prices[asset.symbol!] = { ...(prices[asset.symbol!] ?? {}), [d]: data.c * fx }
        updated.push(asset.symbol!)
      } else {
        failed.push(asset.symbol!)
      }
    } catch {
      failed.push(asset.symbol!)
    }
  }
  return { updated, failed }
}

/** 汇率:法币走 Frankfurter(欧洲央行),BTC 走 Gate / CoinGecko */
export async function fetchFxRates(settings: Settings): Promise<Record<string, number>> {
  const symbols = ['USD', 'HKD', 'EUR']
  const url = `https://api.frankfurter.dev/v1/latest?base=CNY&symbols=${symbols.join(',')}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`汇率接口请求失败 (${res.status})`)
  const data: { rates?: Record<string, number> } = await res.json()
  if (!data.rates) throw new Error('汇率数据为空')

  const fx: Record<string, number> = { ...settings.fxRates }
  for (const s of symbols) {
    const r = data.rates[s]
    if (r && r > 0) fx[s] = 1 / r // base=CNY 返回 CNY→外币,取倒数得 外币→CNY
  }
  fx.USDT = fx.USD // USDT 按美元近似
  const withFx = { ...settings, fxRates: fx }
  const btcCny = await fetchCryptoCnyPrice('bitcoin', withFx).catch(() => undefined)
  if (btcCny != null) fx.BTC = btcCny
  return fx
}
