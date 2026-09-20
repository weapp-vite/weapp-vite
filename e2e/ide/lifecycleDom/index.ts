import type { DomCheckpoint, DomNodeExpectation } from '../../utils/domAcceptance/types'

export const LIFECYCLE_FIXTURE = 'e2e-apps/lifecycle-compare'
export const COMPONENT_ROUTE = '/pages/components/index'
export const PAGE_VARIANTS = ['native', 'wevu-ts', 'wevu-vue'] as const
const PAGE_TITLES = { 'native': 'Native Page', 'wevu-ts': 'WeVu TS Page', 'wevu-vue': 'WeVu Vue Page', 'components': 'Components Page' }

function pageNodes(variant: keyof typeof PAGE_TITLES): DomNodeExpectation[] {
  return [{ selector: '.title', text: PAGE_TITLES[variant] }]
}

function componentNodes(returned: boolean): DomNodeExpectation[] {
  return ['#nativeComp', '#wevuTsComp', '#wevuVueComp'].flatMap(scope => [
    { selector: '.component-attached', scope: [scope], text: 'attached: observed' },
    { selector: '.component-ready', scope: [scope], text: 'ready: observed' },
    ...(returned
      ? [
          { selector: '.component-show', scope: [scope], text: 'show: observed' },
          { selector: '.component-hide', scope: [scope], text: 'hide: observed' },
        ]
      : []),
  ])
}

export function lifecycleCheckpoints(variant: keyof typeof PAGE_TITLES): DomCheckpoint[] {
  const route = `/pages/${variant}/index`
  const fallback = variant === 'native' ? 'wevu-ts' : 'native'
  const checkpoint = (id: string, action: string, nodes: DomNodeExpectation[], target = route): DomCheckpoint => ({
    id: `${variant}:${id}`,
    route: target,
    action,
    nodes,
  })
  return [
    checkpoint('initial', '首屏检查 onLoad/onShow/onReady 和组件挂载结果', [
      ...pageNodes(variant),
      ...['onLoad', 'onShow', 'onReady'].map(hook => ({ selector: `#page-hook-${hook}`, text: `${hook}: observed` })),
      ...(variant === 'components' ? componentNodes(false) : [{ selector: '.item', count: 120 }]),
    ]),
    checkpoint('pulled', '执行下拉刷新并检查回调已呈现', [
      ...pageNodes(variant),
      { selector: '#page-hook-onPullDownRefresh', text: 'onPullDownRefresh: observed' },
    ]),
    checkpoint('scrolled', '滚动页面并检查滚动回调已呈现', [
      ...pageNodes(variant),
      { selector: '#page-hook-onPageScroll', text: 'onPageScroll: observed' },
    ]),
    checkpoint('fallback', '切换至其他 tab 并验收目标页面', [
      ...pageNodes(fallback),
      { selector: '.item', count: 120 },
    ], `/pages/${fallback}/index`),
    checkpoint('returned', '返回原 tab 并验收 show/hide 回调', [
      ...pageNodes(variant),
      { selector: '#page-hook-onShow', text: 'onShow: observed' },
      { selector: '#page-hook-onHide', text: 'onHide: observed' },
      ...(variant === 'components' ? componentNodes(true) : [{ selector: '.item', count: 120 }]),
    ]),
    checkpoint('finalized', '归档生命周期后保留真实观察到的回调', [
      ...pageNodes(variant),
      { selector: '#page-hook-onPullDownRefresh', text: 'onPullDownRefresh: observed' },
      { selector: '#page-hook-onHide', text: 'onHide: observed' },
      ...(variant === 'components' ? componentNodes(true) : []),
    ]),
  ]
}

const ALIAS_LABELS = [
  ['view', 'bindtap', 'view.bindtap'],
  ['view', 'bindColonTap', 'view.bind:tap'],
  ['view', 'bothBindtap', 'view.both(bindtap)'],
  ['view', 'bothBindColonTap', 'view.both(bind:tap)'],
  ['view', 'bothReverseBindtap', 'view.bothReverse(bindtap)'],
  ['view', 'bothReverseBindColonTap', 'view.bothReverse(bind:tap)'],
  ['nativeComponent', 'bindprobe', 'native.bindprobe'],
  ['nativeComponent', 'bindColonProbe', 'native.bind:probe'],
  ['nativeComponent', 'bothBindprobe', 'native.both(bindprobe)'],
  ['nativeComponent', 'bothBindColonProbe', 'native.both(bind:probe)'],
  ['nativeComponent', 'bothReverseBindprobe', 'native.bothReverse(bindprobe)'],
  ['nativeComponent', 'bothReverseBindColonProbe', 'native.bothReverse(bind:probe)'],
  ['wevuSfcComponent', 'bindprobe', 'wevu.bindprobe'],
  ['wevuSfcComponent', 'bindColonProbe', 'wevu.bind:probe'],
  ['wevuSfcComponent', 'bothBindprobe', 'wevu.both(bindprobe)'],
  ['wevuSfcComponent', 'bothBindColonProbe', 'wevu.both(bind:probe)'],
  ['wevuSfcComponent', 'bothReverseBindprobe', 'wevu.bothReverse(bindprobe)'],
  ['wevuSfcComponent', 'bothReverseBindColonProbe', 'wevu.bothReverse(bind:probe)'],
] as const

export function aliasCheckpoint(completed: number): DomCheckpoint {
  const order = ['view:bindtap', 'view:bindColonTap', 'view:bothBindtap', 'view:bothReverseBindtap', 'nativeComponent:bindprobe', 'nativeComponent:bindColonProbe', 'nativeComponent:bothBindprobe', 'nativeComponent:bothReverseBindprobe', 'wevuSfcComponent:bindprobe', 'wevuSfcComponent:bindColonProbe', 'wevuSfcComponent:bothBindprobe', 'wevuSfcComponent:bothReverseBindprobe']
  const observed = new Set(order.slice(0, completed))
  return {
    id: `alias:${completed}`,
    route: COMPONENT_ROUTE,
    action: completed ? `触发第 ${completed} 个事件别名并检查全部渲染计数` : '首屏检查事件别名计数已清零',
    nodes: ALIAS_LABELS.map(([group, key, label]) => ({
      selector: `#binding-${group}-${key}`,
      text: `${label}: ${observed.has(`${group}:${key}`) ? 1 : 0}`,
    })),
  }
}

export function namedEventCheckpoint(completed: number): DomCheckpoint {
  const nodes: DomNodeExpectation[] = []
  let operation = 0
  for (const kind of ['hyphen', 'underscore']) {
    for (const [group, label] of [['nativeComponent', 'native'], ['wevuSfcComponent', 'wevu']]) {
      const enabled = (offset: number) => completed >= operation + offset
      const values = {
        bind: kind === 'underscore' && enabled(1) ? 1 : 0,
        bindColon: enabled(2) ? 1 : 0,
        bothBind: kind === 'underscore' && enabled(3) ? 1 : 0,
        bothBindColon: kind === 'hyphen' && enabled(3) ? 1 : 0,
      }
      for (const [key, suffix] of [['bind', 'bind'], ['bindColon', 'bind:xxx'], ['bothBind', 'both bind'], ['bothBindColon', 'both bind:xxx']] as const) {
        nodes.push({ selector: `#named-${kind}-${group}-${key}`, text: `${label} ${kind} ${suffix}: ${values[key]}` })
      }
      operation += 3
    }
  }
  return { id: `named:${completed}`, route: COMPONENT_ROUTE, action: completed ? `触发第 ${completed} 个命名事件并检查渲染计数` : '首屏检查命名事件计数已清零', nodes }
}
