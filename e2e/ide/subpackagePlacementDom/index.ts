import type { DomCheckpoint, DomNodeExpectation } from '../../utils/domAcceptance/types'

export const subpackagePlacementRoutes = [
  { id: 'main', route: '/pages/index/index', initial: 0, expected: { count: 1, double: 2 } },
  { id: 'normal', route: '/subpackages/normal-wevu/pages/entry/index', initial: 0, expected: { count: 1, double: 2 } },
  { id: 'normal-detail', route: '/subpackages/normal-wevu/pages/detail/index', initial: 1, expected: { count: 1, double: 2, from: 'direct' } },
  { id: 'independent', route: '/subpackages/independent-wevu/pages/entry/index', initial: 10, expected: { count: 11, double: 22 } },
  { id: 'independent-detail', route: '/subpackages/independent-wevu/pages/detail/index', initial: 11, expected: { count: 11, double: 22, from: 'direct' } },
] as const

const markerTexts = {
  'main': '__WSP_MAIN_VUE__',
  'normal': '__WSP_NORMAL_ENTRY__',
  'normal-detail': '__WSP_NORMAL_DETAIL__',
  'independent': '__WSP_INDEPENDENT_ENTRY__',
  'independent-detail': '__WSP_INDEPENDENT_DETAIL__',
}

function renderedState(id: keyof typeof markerTexts, count: number): DomNodeExpectation[] {
  const isMain = id === 'main'
  const prefix = isMain ? 'main-vue-card' : id
  const scope = isMain ? [{ has: '#main-vue-card-title' }] : undefined
  return [
    { selector: `#${id}-marker`, text: markerTexts[id] },
    { selector: `#${prefix}-count`, scope, text: `count: ${count}` },
    { selector: `#${prefix}-double`, scope, text: `double: ${count * 2}` },
    ...(isMain ? [{ selector: '#main-vue-card-title', scope, text: 'main package vue card' }] : []),
    ...(id.endsWith('-detail') ? [{ selector: `#${id}-from`, text: 'from: direct' }] : []),
  ]
}

export const subpackagePlacementCheckpoints: DomCheckpoint[] = subpackagePlacementRoutes.flatMap(routeCase => [
  {
    id: `${routeCase.id}:initial`,
    route: routeCase.route,
    action: '打开页面，检查所属分包、共享计数和派生值',
    nodes: renderedState(routeCase.id, routeCase.initial),
  },
  {
    id: `${routeCase.id}:result`,
    route: routeCase.route,
    action: '执行页面场景，检查计数结果及后续详情页共享状态',
    nodes: renderedState(routeCase.id, routeCase.expected.count),
  },
])
