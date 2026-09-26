import type { DomCheckpoint } from '../../utils/domAcceptance/types'

export const JSX_OPTION_CHECKPOINTS: DomCheckpoint[] = [
  { id: 'jsx:initial', route: '/pages/jsx-basic/index', action: '检查 JSX 初始计数', nodes: [
    { selector: '#jsx-count', text: '当前计数： 0' },
    { selector: '#jsx-increase', text: '计数 +1' },
  ] },
  { id: 'jsx:incremented', route: '/pages/jsx-basic/index', action: '递增后检查 JSX 计数', nodes: [{ selector: '#jsx-count', text: '当前计数： 1' }] },
  { id: 'vue-tsx:initial', route: '/pages/vue-tsx/index', action: '检查 Vue TSX 开关初始状态', nodes: [
    { selector: '#vue-tsx-state.card-on', text: '当前状态：已启用 ✅' },
    { selector: '#vue-tsx-toggle', text: '切换状态' },
  ] },
  { id: 'vue-tsx:disabled', route: '/pages/vue-tsx/index', action: '切换后检查禁用状态与样式 class', nodes: [
    { selector: '#vue-tsx-state.card-off', text: '当前状态：未启用 ⛔️' },
    { selector: '#vue-tsx-state.card-on', count: 0 },
  ] },
]

export const JSX_ISLAND_CHECKPOINTS: DomCheckpoint[] = [
  { id: 'island:initial', route: '/pages/tsx-basic/index', action: '检查动态岛和列表初始内容', nodes: [
    { selector: '#tsx-island-button', text: 'dynamic island: 0' },
    { selector: '.row', count: 3 },
    { selector: '#tsx-card-event', text: 'card event:' },
  ] },
  { id: 'island:incremented', route: '/pages/tsx-basic/index', action: '派发动态岛事件后检查计数', nodes: [
    { selector: '#tsx-island-button', text: 'dynamic island: 1' },
    { selector: '#tsx-card-event', text: 'card event:' },
  ] },
  { id: 'island:component-event', route: '/pages/tsx-basic/index', action: '组件事件后检查父页面呈现结果和保留计数', nodes: [
    { selector: '#tsx-island-button', text: 'dynamic island: 1' },
    { selector: '#tsx-card-event', text: 'card event:  info-card-change' },
  ] },
]

export const JSX_SETUP_CHECKPOINTS: DomCheckpoint[] = [
  { id: 'setup:initial', route: '/pages/setup-render/index', action: '检查 setup render 初始闭包计数', nodes: [{ selector: '#setup-render-count', text: 'setup count: 2' }] },
  { id: 'setup:incremented', route: '/pages/setup-render/index', action: '更新后检查 setup render 闭包计数', nodes: [{ selector: '#setup-render-count', text: 'setup count: 3' }] },
  { id: 'sfc-jsx:initial', route: '/pages/sfc-script-jsx/index', action: '检查 SFC JSX 初始计数', nodes: [{ selector: '#sfc-jsx-count', text: 'sfc jsx count: 4' }] },
  { id: 'sfc-jsx:incremented', route: '/pages/sfc-script-jsx/index', action: '检查 SFC JSX 更新后计数', nodes: [{ selector: '#sfc-jsx-count', text: 'sfc jsx count: 5' }] },
  { id: 'sfc-setup:initial', route: '/pages/sfc-script-setup-tsx/index', action: '检查 SFC setup TSX 初始标签', nodes: [{ selector: '#sfc-setup-tsx-label', text: 'setup-tsx-ready' }] },
  { id: 'sfc-setup:updated', route: '/pages/sfc-script-setup-tsx/index', action: '派发内联事件后检查标签', nodes: [{ selector: '#sfc-setup-tsx-label', text: 'setup-tsx-updated' }] },
]
