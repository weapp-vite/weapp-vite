import type { DomCheckpoint, DomNodeExpectation, DomStyleExpectation } from '../../utils/domAcceptance/types'
import { resolveRuntimeProviderName } from '../../utils/runtimeProvider'

const realLayout = resolveRuntimeProviderName() === 'devtools'

function node(selector: string, text: string): DomNodeExpectation {
  return { selector, text }
}

function styled(selector: string, text: string, styles: Record<string, DomStyleExpectation>): DomNodeExpectation {
  return { selector, text, ...(realLayout ? { styles, visible: true } : {}) }
}

function checkpoint(page: string, phase: string, nodes: DomNodeExpectation[]): DomCheckpoint {
  return { id: `${page}:${phase}`, route: `/pages/${page}/index`, action: `${phase}: ${page} 页面实际节点与执行结果`, nodes }
}

export function runtimeLayoutNodes(layout: 'default' | 'admin' | 'none'): DomNodeExpectation[] {
  return [
    node('.hero__title', 'Layouts HMR Playground'),
    node('#layout-current', `current: ${layout}`),
    node('#layout-script', 'script: LAYOUTS-PAGE-SCRIPT-BASE'),
    { selector: '.card__title', count: 3 },
    { selector: '.action-btn', count: 3 },
    { selector: 'component', has: '.layout-default', count: layout === 'default' ? 1 : 0 },
    { selector: 'component', has: '.layout-admin', count: layout === 'admin' ? 1 : 0 },
    ...(layout === 'default'
      ? [{ selector: '.layout-default__marker', scope: [{ has: '.layout-default' }], text: 'DEFAULT-LAYOUT-TEMPLATE-BASE' }]
      : []),
    ...(layout === 'admin'
      ? [
          { selector: '.layout-admin__title', scope: [{ has: '.layout-admin' }], text: 'LAYOUTS-ADMIN-TITLE-BASE' },
          { selector: '.layout-admin__subtitle', scope: [{ has: '.layout-admin' }], text: 'LAYOUTS-ADMIN-SUBTITLE-BASE' },
        ]
      : []),
  ]
}

function styleMatrixNodes(updated: boolean): DomNodeExpectation[] {
  return [
    node('.title', 'Style Matrix'),
    { selector: '.cell', count: 10 },
    styled(`#style-string[style*="${updated ? '#0f766e' : '#1f2937'}"]`, 'style-string', { color: updated ? 'rgb(15, 118, 110)' : 'rgb(31, 41, 55)' }),
    styled(realLayout ? '#style-object' : `#style-object[style*="font-size:${updated ? '28' : '24'}rpx"]`, 'style-object', { 'font-size': { rpx: updated ? 28 : 24 }, 'border-top-left-radius': { rpx: updated ? 12 : 8 } }),
    node(`#style-camel[style*="webkit-line-clamp:${updated ? '3' : '2'}"]`, 'style-camel'),
    styled(realLayout ? '#style-array' : `#style-array[style*="padding:${updated ? '8' : '4'}rpx"]`, 'style-array', { 'padding-top': { rpx: updated ? 8 : 4 } }),
    styled(`#style-nested[style*="opacity:${updated ? '1' : '0.95'}"]`, 'style-nested', { opacity: updated ? '1' : '0.95' }),
    styled(`#style-nullable[style*="${updated ? '#111827' : '#374151'}"]`, 'style-nullable', { color: updated ? 'rgb(17, 24, 39)' : 'rgb(55, 65, 81)' }),
    styled(`#style-override[style*="${updated ? '#345678' : '#333333'}"]`, 'style-override', { color: updated ? 'rgb(52, 86, 120)' : 'rgb(51, 51, 51)' }),
    styled(`#style-important[style*="${updated ? '#ff4d4f' : '#f5222d'}"]`, 'style-important', { color: updated ? 'rgb(255, 77, 79)' : 'rgb(245, 34, 45)' }),
    styled(`#style-css-var[style*="${updated ? '#e6f4ff' : '#f6ffed'}"]`, 'style-css-var', { 'background-color': updated ? 'rgb(230, 244, 255)' : 'rgb(246, 255, 237)' }),
    styled(`#style-conditional[style*="${updated ? 'solid' : 'dashed'}"]`, 'style-conditional', { 'border-top-style': updated ? 'solid' : 'dashed' }),
  ]
}

const sharedStoreNodes = [node('#store-setup', 'setup: 1 shared'), node('#store-options', 'options: 1 shared')]

export const RUNTIME_ALL_PAGE_CHECKPOINTS: DomCheckpoint[] = [
  checkpoint('reactivity', 'initial', [node('.title', 'Reactivity'), node('#reactivity-count', 'count:'), node('#reactivity-watch', 'watch:')]),
  checkpoint('reactivity', 'result', [node('#reactivity-count', 'count: 7'), node('#reactivity-doubled', 'doubled: 14'), node('#reactivity-watch', 'watch: 1,4'), node('#reactivity-shallow', 'shallow: 1')]),
  checkpoint('runtime', 'initial', [node('.title', 'Runtime'), node('#runtime-ref', 'template-ref'), node('#runtime-form', 'form: hello'), node('#runtime-injected', 'injected: local-value global-value')]),
  checkpoint('runtime', 'result', [node('#runtime-form', 'form: changed'), node('#runtime-scroll', 'scroll: observed'), node('#runtime-injected', 'injected: local-value global-value')]),
  checkpoint('store', 'initial', [node('.title', 'Store'), ...sharedStoreNodes]),
  checkpoint('store', 'result', sharedStoreNodes),
  checkpoint('store-share', 'initial', [node('.title', 'Store Share'), ...sharedStoreNodes]),
  checkpoint('store-share', 'result', sharedStoreNodes),
  checkpoint('diff', 'initial', [node('.title', 'Diff'), node('#diff-count', 'count: 0'), node('#diff-nested', 'nested: 1'), node('#diff-list', 'list: 1,2')]),
  checkpoint('diff', 'result', [node('#diff-count', 'count: 1'), node('#diff-nested', 'nested: 2'), node('#diff-list', 'list: 1,2,3')]),
  checkpoint('hmr', 'initial', [node('.title', 'HMR'), node('#hmr-count', 'count: 1')]),
  checkpoint('hmr', 'result', [node('.title', 'HMR'), node('#hmr-count', 'count: 4')]),
  checkpoint('layouts', 'initial', runtimeLayoutNodes('default')),
  checkpoint('class-style', 'initial', [
    node('.title', 'Class Style'),
    styled('#class-style-target.state-idle.disabled', 'class-style-target', { color: 'rgb(17, 17, 17)' }),
    { selector: '#guard-root-class', count: 0 },
  ]),
  checkpoint('class-style', 'result', [
    styled('#class-style-target.state-ready.active.ready', 'class-style-target', { color: 'rgb(0, 82, 217)' }),
    node('#guard-root-class.root-ready', 'root-guard-class'),
  ]),
  checkpoint('root-guard', 'initial', [node('.title', 'Root Guard Class'), { selector: '#root-guard-inline', count: 0 }]),
  checkpoint('root-guard', 'result', [node('.title', 'Root Guard Class'), { selector: '#root-guard-inline', count: 0 }]),
  checkpoint('style-matrix', 'initial', styleMatrixNodes(false)),
  checkpoint('style-matrix', 'result', styleMatrixNodes(true)),
  checkpoint('hmr-sfc', 'initial', [node('.title', 'HMR-SFC'), node('.marker', 'HMR-SFC-SCRIPT')]),
  checkpoint('hmr-html', 'initial', [node('.title', 'HMR-HTML'), node('.content', 'HMR-HTML-TEMPLATE')]),
]

export const RUNTIME_LAYOUT_CHECKPOINTS: DomCheckpoint[] = ['default', 'admin', 'none', 'default'].map((layout, index) => ({
  id: `layout:${index}:${layout}`,
  route: '/pages/layouts/index',
  action: `切换布局为 ${layout}，验证页面内容与真实布局宿主`,
  nodes: runtimeLayoutNodes(layout as 'default' | 'admin' | 'none'),
}))

export const RUNTIME_SCROLL_CHECKPOINTS: DomCheckpoint[] = [
  { id: 'scroll:initial', route: '/pages/runtime/index', action: '检查滚动前的表单和滚动状态', nodes: [node('#runtime-form', 'form: hello'), node('#runtime-scroll', 'scroll: idle')] },
  { id: 'scroll:observed', route: '/pages/runtime/index', action: '滚动后检查实际渲染的回调状态和保留的表单', nodes: [node('#runtime-form', 'form: hello'), node('#runtime-scroll', 'scroll: observed')] },
]
