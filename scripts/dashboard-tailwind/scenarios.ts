export const dashboardTailwindScenarios = [
  'official',
  'weapp-default',
  'weapp-target-web',
  'weapp-basedir-target-web',
  'weapp-app-type-target-web',
  'weapp-full',
  'weapp-full-no-source-candidates',
] as const

export type DashboardTailwindScenario = typeof dashboardTailwindScenarios[number]

export const dashboardTailwindConfigScenarios: DashboardTailwindScenario[] = [
  'official',
  'weapp-default',
  'weapp-target-web',
  'weapp-basedir-target-web',
  'weapp-app-type-target-web',
  'weapp-full',
]

export const dashboardTailwindPerformanceScenarios: DashboardTailwindScenario[] = [
  'official',
  'weapp-full',
  'weapp-full-no-source-candidates',
]

export function isDashboardTailwindScenario(value: string): value is DashboardTailwindScenario {
  return dashboardTailwindScenarios.includes(value as DashboardTailwindScenario)
}
