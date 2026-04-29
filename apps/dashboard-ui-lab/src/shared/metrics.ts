export interface DashboardLabMetric {
  label: string
  value: string
  tone: 'stable' | 'watch' | 'risk'
}

const baseMetrics: DashboardLabMetric[] = [
  {
    label: '主包页面',
    value: '2',
    tone: 'stable',
  },
  {
    label: '分包覆盖',
    value: '3',
    tone: 'watch',
  },
  {
    label: '共享模块',
    value: 'shared/*',
    tone: 'risk',
  },
]

export function createDashboardLabMetrics(scope: string): DashboardLabMetric[] {
  return baseMetrics.map(metric => ({
    ...metric,
    label: `${scope} · ${metric.label}`,
  }))
}

export function createPackageScore(seed: number) {
  return {
    modules: 6 + seed,
    files: 4 + seed,
    bytes: 2048 + seed * 1536,
  }
}
