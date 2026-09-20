import type { StaticRouteValue } from 'wevu/compiler'

export interface NamedAutoRoute {
  name: string
  path: string
  meta: Record<string, StaticRouteValue>
}
