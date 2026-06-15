import type { Asset, PriceHistory, Settings } from '../types'
import { today } from './storage'

/**
 * PriceService — 行情与汇率。
 * 渐进增强:不配置任何 key 也能用(加密货币 CoinGecko、汇率 Frankfurter 均免费免注册);
 * 配置 Finnhub key 后可自动更新美股行情;其余资产手动估值。
 */

export interface PriceUpdateResult {
  updated: string[]
  failed: string[]
}

/** 加密货币:CoinGecko 免费接口,直接取 CNY 计价 */
export async function fetchCryptoPrices(
  assets: Asset[],
  prices: PriceHistory,
): Promise<PriceUpdateResult> {
  const ids = [
    ...new Set(
      assets
        .filter((a) => !a.archived && a.priceSource === 'coingecko' && a.symbol)
        .map((a) => a.symbol!.toLowerCase()),
    ),
  ]
  if (ids.length === 0) return { updated: [], failed: [] }

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=cny`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CoinGecko 请求失败 (${res.status})`)
  const data: Record<string, { cny?: number }> = await res.json()

  const updated: string[] = []
  const failed: string[] = []
  const d = today()
  for (const id of ids) {
    const price = data[id]?.cny
    if (price && price > 0) {
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

/** 汇率:Frankfurter 免费接口(欧洲央行数据) */
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
  return fx
}
