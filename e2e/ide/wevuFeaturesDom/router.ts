import type { DomCheckpoint, DomNodeExpectation } from '../../utils/domAcceptance/types'

export const ROUTER_INDEX_ROUTE = '/pages/router-stability/index'
export const ROUTER_SUB_ROUTE = '/pages/router-stability/sub/index'
export const ROUTER_PAGE_TARGET = '/pages/router-stability/target/index'
export const ROUTER_COMPONENT_TARGET = '/components/router-origin-probe/target/index'
export const SHOWCASE_ROUTE = '/pages/router-showcase/index'
export const DYNAMIC_ROUTE = '/pages/router-dynamic/index'

export function routerCheckpoint(id: string, route: string, action: string, nodes: DomNodeExpectation[]): DomCheckpoint {
  return { id, route, action, nodes }
}

export const routerIndexNodes: DomNodeExpectation[] = [
  { selector: '.router-stability-page__title', text: 'router stability (page context)' },
  { selector: '#router-open-sub', text: '打开 sub 页面' },
  { selector: '#router-index-page-router', text: '当前页触发 pageRouter.navigateTo(\'./target/index\')' },
]

export const routerSubNodes: DomNodeExpectation[] = [
  { selector: '.router-sub-page__title', text: 'router stability (sub page)' },
  { selector: '#router-sub-call-component-router', text: '组件 this.router.navigateTo(\'./target/index\')' },
  { scope: ['#router-origin-probe'], selector: '.router-origin-probe__title', text: 'component router origin probe' },
  { scope: ['#router-origin-probe'], selector: '#cmp-router-nav', text: 'this.router.navigateTo(\'./target/index\')' },
]

export function routerTargetNodes(kind: 'page' | 'component'): DomNodeExpectation[] {
  return [{
    selector: kind === 'page' ? '#router-target-main-marker' : '#router-target-component-marker',
    text: kind === 'page'
      ? 'route=pages/router-stability/target/index source=page-router-from-index'
      : 'route=components/router-origin-probe/target/index source=component-router',
  }]
}

const showcaseResults = [
  ['parse', 'parse summary', '{"tag":["alpha","beta"],"flag":null,"count":"2"}'],
  ['stringify', 'stringify summary', 'tag=alpha&tag=beta&flag&count=2'],
  ['named-path', 'named path', '/pages/router-showcase/profile/12/detail/logs?from=named'],
  ['alias-path', 'alias path', '/router-profile/9/detail-alias/trace'],
  ['relative', 'relative summary', '/pages/router-showcase/profile/3/detail/metrics?from=relative'],
  ['hash-only', 'hash-only summary', 'aborted'],
  ['forward', 'forward summary', 'aborted'],
  ['go', 'go summary', 'noop'],
  ['ready', 'ready summary', 'ready'],
] as const

export function showcaseNodes(completed: boolean): DomNodeExpectation[] {
  return [
    { selector: '.router-showcase-page__title', text: 'wevu/router 能力展示 (showcase)' },
    ...showcaseResults.map(([id, label, value]) => ({
      selector: `#router-showcase-${id}`,
      text: `${label} = ${completed ? value : 'pending'}`,
    })),
    { selector: '#router-showcase-run', text: `run summary = ${completed ? 'ok' : 'idle'}` },
  ]
}

const dynamicResults = [
  ['base-current', 'base current path', '/pages/router-dynamic/index'],
  ['options-current', 'options current path', '/pages/router-dynamic/index'],
  ['cleared-count', 'routes after clear', '0'],
  ['add-remove', 'add/remove summary', 'added|/router-dynamic/parent/5/child/metrics?from=dynamic|removed|stable'],
  ['guard', 'guard summary', 'block-ok|error-ok|after=2'],
  ['error', 'error summary', 'guard-fail-intentional'],
] as const

export function dynamicNodes(completed: boolean): DomNodeExpectation[] {
  return [
    { selector: '.router-dynamic-page__title', text: 'wevu/router 能力展示 (dynamic + guards)' },
    ...dynamicResults.map(([id, label, value]) => ({
      selector: `#router-dynamic-${id}`,
      text: `${label} = ${completed ? value : 'pending'}`,
    })),
    { selector: '#router-dynamic-run', text: `run summary = ${completed ? 'ok' : 'idle'}` },
  ]
}
