import { palette } from '../theme/colors'

/** ECharts 深色主题公共配置 */
export const darkAxis = {
  axisLine: { lineStyle: { color: palette.surfaceBorder } },
  axisLabel: { color: palette.textMuted },
  splitLine: { lineStyle: { color: palette.scrollbar } },
}

export const darkTooltip = {
  backgroundColor: palette.surface,
  borderColor: palette.surfaceBorder,
  textStyle: { color: palette.text },
}
