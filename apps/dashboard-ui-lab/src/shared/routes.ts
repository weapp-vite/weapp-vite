import { formatRouteLabel } from './format'

export interface DashboardLabRoute {
  label: string
  path: string
  description: string
}

const routes = [
  '/pages/analysis/index',
  '/packages/quality/index',
  '/packages/runtime/index',
  '/packages/independent/index',
]

export function createDashboardLabRoutes(): DashboardLabRoute[] {
  return routes.map(path => ({
    path,
    label: formatRouteLabel(path),
    description: path.includes('independent') ? '独立分包验证入口' : '普通页面或分包验证入口',
  }))
}
