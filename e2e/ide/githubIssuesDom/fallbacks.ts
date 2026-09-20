import type { DomCheckpoint, DomProvider } from '../../utils/domAcceptance/types'
import { githubText as text } from './nodes'

function initial(route: string, action: string, nodes: DomCheckpoint['nodes']): DomCheckpoint[] {
  return [{ id: 'initial', route: `/pages/${route}/index`, action, nodes }]
}

export function fallbackPlans(provider: DomProvider) {
  return {
    issue520: initial('issue-520', '检查 resolver 引入的组件接收普通与具名插槽', [
      text('#issue520-header', 'issue-520 resolver slot header'),
      text('#issue520-default', 'issue-520 resolver slot default'),
    ]),
    issue521: initial('issue-521', '检查 scoped-slot 的两个 flex 子项与真实布局样式', [
      { selector: '.issue521-scoped-flex-host', scope: ['#issue521-host'], ...(provider === 'devtools' ? { styles: { 'display': 'flex', 'flex-direction': 'row', 'flex-wrap': 'nowrap' }, visible: true } : {}) },
      ...['A', 'B'].map(label => ({
        ...text('.issue521-flex-item', `${label}: zero`, ['#issue521-host', { has: '#issue521-a' }, `#issue521-${label.toLowerCase()}`]),
        ...(provider === 'devtools' ? { visible: true } : {}),
      })),
    ]),
    issue528: initial('issue-528', '分别检查空卡片 fallback 与已提供插槽的互斥性', [
      text('.issue528-fallback-header', 'issue-528 fallback header', ['#issue528-empty']),
      text('.issue528-fallback-default', 'issue-528 fallback default', ['#issue528-empty']),
      text('.issue528-provided-header', 'issue-528 provided header'),
      text('.issue528-provided-default', 'issue-528 provided default'),
      { selector: '.issue528-fallback-header', scope: ['#issue528-provided'], count: 0 },
      { selector: '.issue528-fallback-default', scope: ['#issue528-provided'], count: 0 },
    ]),
    issue530: initial('issue-530', '检查 scoped-slot 缺省内容和实际投影互斥', [
      text('.issue530-fallback-default', 'issue-530 fallback default', ['#issue530-empty']),
      text('.issue530-scoped-fallback-default', 'issue-530 scoped fallback default', ['#issue530-empty']),
      text('.issue530-provided-default', 'issue-530 provided default: issue-530 scoped slot prop', ['#issue530-provided', { has: '.issue530-provided-default' }]),
      { selector: '.issue530-fallback-default', scope: ['#issue530-provided'], count: 0 },
      { selector: '.issue530-scoped-fallback-default', scope: ['#issue530-provided'], count: 0 },
    ]),
    outlet: initial('scoped-slot-outlet-fallback', '检查两个原生具名插槽的实际内容', [
      text('#slot-outlet-main', 'scoped slot outlet native main fallback'),
      text('#slot-outlet-footer', 'scoped slot outlet native footer fallback'),
    ]),
    compilerOff: initial('slot-fallback-compiler-off', '编译器关闭时检查普通插槽和 fallback 互斥', [
      text('.slot-fallback-off-fallback-header', 'slot-fallback-compiler-off fallback header', ['#slot-off-empty']),
      text('.slot-fallback-off-fallback-default', 'slot-fallback-compiler-off fallback default', ['#slot-off-empty']),
      text('.slot-fallback-off-provided-header', 'slot-fallback-compiler-off provided header'),
      text('.slot-fallback-off-provided-default', 'slot-fallback-compiler-off provided default'),
      { selector: '.slot-fallback-off-fallback-header', scope: ['#slot-off-provided'], count: 0 },
      { selector: '.slot-fallback-off-fallback-default', scope: ['#slot-off-provided'], count: 0 },
    ]),
  }
}
