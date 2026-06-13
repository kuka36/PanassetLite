import { palette } from '../theme/colors'

/** ECharts 浅色主题公共配置 */
export const lightAxis = {
  axisLine: { lineStyle: { color: palette.surfaceBorder } },
  axisLabel: { color: palette.textMuted },
  splitLine: { lineStyle: { color: '#e2e8f0' } },
}

export const lightTooltip = {
  backgroundColor: palette.surface,
  borderColor: palette.surfaceBorder,
  textStyle: { color: palette.textTitle },
}

/** @deprecated 使用 lightAxis */
export const darkAxis = lightAxis

/** @deprecated 使用 lightTooltip */
export const darkTooltip = lightTooltip
