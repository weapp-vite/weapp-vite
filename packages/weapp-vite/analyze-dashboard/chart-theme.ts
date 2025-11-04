import * as echarts from 'echarts/core'

export const DASHBOARD_THEME = 'weapp-dark-treemap'
export const DASHBOARD_BACKGROUND = '#0f172a'
export const COLOR_PALETTE = [
  '#38bdf8',
  '#818cf8',
  '#34d399',
  '#fbbf24',
  '#f97316',
  '#f472b6',
  '#22d3ee',
  '#a855f7',
  '#2dd4bf',
  '#facc15',
]

let registered = false

export function ensureDashboardTheme() {
  if (registered) {
    return
  }

  echarts.registerTheme(DASHBOARD_THEME, {
    backgroundColor: DASHBOARD_BACKGROUND,
    color: COLOR_PALETTE,
    textStyle: {
      color: '#e2e8f0',
      fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'rgba(148, 163, 184, 0.3)',
      textStyle: {
        color: '#f8fafc',
      },
    },
  })

  registered = true
}
