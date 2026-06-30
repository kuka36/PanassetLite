import type { Asset, PriceHistory, Settings } from '../types'
import { fetchCryptoPrices, fetchFxRates, fetchStockPrices } from './prices'

function clonePrices(prices: PriceHistory): PriceHistory {
  return JSON.parse(JSON.stringify(prices))
}

function hasCryptoAssets(assets: Asset[]): boolean {
  return assets.some((a) => !a.archived && a.priceSource === 'coingecko' && a.symbol)
}

export type CryptoRefreshResult =
  | { kind: 'skip'; message: string }
  | { kind: 'ok'; prices: PriceHistory; settings: Settings; message: string }

/** 仅刷新 CoinGecko 加密货币行情；同日重复调用覆盖当天价格点 */
export async function runRefreshCryptoPrices(params: {
  assets: Asset[]
  settings: Settings
  prices: PriceHistory
}): Promise<CryptoRefreshResult> {
  const { assets, settings, prices: pricesIn } = params
  if (!hasCryptoAssets(assets)) {
    return { kind: 'skip', message: '当前没有配置 CoinGecko 自动行情的加密资产' }
  }

  const prices = clonePrices(pricesIn)
  const r = await fetchCryptoPrices(assets, prices)
  const newSettings = { ...settings, pricesUpdatedAt: Date.now() }

  const messages: string[] = []
  if (r.updated.length) messages.push(`已更新 ${r.updated.join('、')}`)
  if (r.failed.length) messages.push(`失败:${r.failed.join('、')}`)
  const message = messages.join('; ') || '没有获取到新价格'

  return { kind: 'ok', prices, settings: newSettings, message }
}

/** 一键刷新：汇率 → 加密货币 → 美股（已配置 key 时） */
export async function runRefreshAllPrices(params: {
  assets: Asset[]
  settings: Settings
  prices: PriceHistory
}): Promise<{ prices: PriceHistory; settings: Settings; message: string }> {
  const { assets, settings: settingsIn, prices: pricesIn } = params
  const messages: string[] = []
  const prices = clonePrices(pricesIn)
  let newSettings = settingsIn

  try {
    const fxRates = await fetchFxRates(newSettings)
    newSettings = { ...newSettings, fxRates, fxUpdatedAt: Date.now() }
    messages.push('汇率已更新')
  } catch (e) {
    messages.push(`汇率更新失败:${(e as Error).message}`)
  }

  try {
    const r = await fetchCryptoPrices(assets, prices)
    if (r.updated.length) messages.push(`加密货币 ${r.updated.length} 项已更新`)
    if (r.failed.length) messages.push(`加密货币失败:${r.failed.join(', ')}`)
  } catch (e) {
    messages.push(`加密货币行情失败:${(e as Error).message}`)
  }

  const hasStock = assets.some((a) => a.priceSource === 'finnhub' && !a.archived)
  if (hasStock) {
    try {
      const r = await fetchStockPrices(assets, prices, newSettings)
      if (r.updated.length) messages.push(`股票 ${r.updated.length} 项已更新`)
      if (r.failed.length) messages.push(`股票失败:${r.failed.join(', ')}`)
    } catch (e) {
      messages.push(`股票行情失败:${(e as Error).message}`)
    }
  }

  newSettings = { ...newSettings, pricesUpdatedAt: Date.now() }
  const message = messages.join(';') || '没有需要自动更新的资产'

  return { prices, settings: newSettings, message }
}
