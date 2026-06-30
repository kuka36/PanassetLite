import { useStore } from '../store'
import { StorageService } from './storage'
import { runRefreshAllPrices, runRefreshCryptoPrices } from './priceRefresh'

/** 一键刷新行情并写回 store + localStorage */
export async function refreshPrices(): Promise<string> {
  const { assets, settings, prices } = useStore.getState()
  const result = await runRefreshAllPrices({ assets, settings, prices })
  StorageService.savePrices(result.prices)
  StorageService.saveSettings(result.settings)
  useStore.setState({ prices: result.prices, settings: result.settings })
  return result.message
}

/** 仅刷新 CoinGecko 加密货币行情并写回 store + localStorage */
export async function refreshCryptoPrices(): Promise<string> {
  const { assets, settings, prices } = useStore.getState()
  const result = await runRefreshCryptoPrices({ assets, settings, prices })
  if (result.kind === 'skip') return result.message
  StorageService.savePrices(result.prices)
  StorageService.saveSettings(result.settings)
  useStore.setState({ prices: result.prices, settings: result.settings })
  return result.message
}
