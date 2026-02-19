export interface RetailRouteMeta {
  path: string
  title: string
  group: string
  tab?: boolean
}

export interface RetailMokupScene {
  route: string
  title: string
  group: string
  summary: string
  kpis: Array<{
    label: string
    value: string
  }>
  actions: Array<{
    label: string
    route: string
  }>
}
