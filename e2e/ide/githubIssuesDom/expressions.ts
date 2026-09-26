import type { GithubDomStep } from './index'
import { githubText as text } from './index'

export const CALL_EXPRESSIONS: GithubDomStep[] = [
  { id: 'initial', action: '首屏显示 v-bind、列表和多参数调用结果', nodes: [
    text('.issue297-bind .issue297-case-result', 'Hello-1-root-dasd'),
    text('#issue297-row-0 .issue297-row-text', 'Hello-1-Alpha-dasd'),
    text('#issue297-row-1 .issue297-row-text', 'Hello-1-Beta-dasd'),
    { selector: '.issue297-row', count: 2 },
  ] },
  { id: 'active', action: '切换激活项并更新多参数调用', method: 'cycleActive', nodes: [
    text('#issue297-active-label', 'Hello-1-Beta-dasd'),
    text('#issue297-active-meta', 'Hello-1-row-1-meta-dasd'),
  ] },
  { id: 'appended', action: '新增列表项并执行该项调用表达式', method: 'appendRow', nodes: [
    text('#issue297-row-2 .issue297-row-text', 'Hello-1-Extra-2-dasd'),
    text('#issue297-row-2 .issue297-row-subtext', 'Hello-1-row-2-dasd'),
    { selector: '.issue297-row', count: 3 },
  ] },
  { id: 'hidden', action: '隐藏列表并显示 v-else 调用结果', method: 'toggleListCase', nodes: [
    text('.issue297-empty-text', '列表已隐藏: Hello-1-hidden-dasd'),
    { selector: '.issue297-row', count: 0 },
  ] },
  { id: 'restored', action: '重新显示追加后的列表', method: 'toggleListCase', nodes: [
    text('#issue297-row-2 .issue297-row-text', 'Hello-1-Extra-2-dasd'),
    { selector: '.issue297-empty', count: 0 },
    { selector: '.issue297-row', count: 3 },
  ] },
  { id: 'reset', action: '重置列表移除追加节点并保留当前激活项', method: 'resetRows', nodes: [
    text('#issue297-active-label', 'Hello-1-Beta-dasd'),
    { selector: '.issue297-row', count: 2 },
    { selector: '#issue297-row-2', count: 0 },
  ] },
]

export const SETUP_CALL_EXPRESSIONS: GithubDomStep[] = [
  { id: 'initial', action: '首屏显示循环、成员、模板字符串和可选调用的真实结果', nodes: [
    text('.issue297m-inline-anchor', 'anchor'),
    text('.issue297m-bind .issue297m-result', 'bind-Alpha-dasd'),
    text('#issue297m-row-0', 'loop-Alpha-tail'),
    text('#issue297m-row-1', 'loop-Beta-tail'),
    text('#issue297m-member-result', 'MEMBER-ALPHA-TAIL'),
    text('#issue297m-template-result', 'P-123'),
    text('#issue297m-wrap-result', '[wrap-row-0-tail]'),
    text('#issue297m-optional-result', 'Maybe-row-0'),
  ] },
  { id: 'active', action: '切换激活项同步更新所有依赖调用', method: 'cycleActive', nodes: [
    text('.issue297m-bind .issue297m-result', 'bind-Beta-dasd'),
    text('#issue297m-member-result', 'MEMBER-BETA-TAIL'),
    text('#issue297m-wrap-result', '[wrap-row-1-tail]'),
    text('#issue297m-optional-result', 'Maybe-row-1'),
    text('#issue297m-ternary-result', 'ternary-row-1-dasd'),
  ] },
  { id: 'optional-disabled', action: '禁用可选函数并渲染 nullish 兜底', method: 'toggleOptionalInvoker', nodes: [
    text('#issue297m-optional-result', 'none'),
    text('.issue297m-bind .issue297m-result', 'bind-Beta-dasd'),
  ] },
  { id: 'case-hidden', action: '隐藏调用条件区域并渲染 ternary 的 closed 分支', method: 'toggleShowCase', nodes: [
    text('#issue297m-ternary-result', 'closed'),
    { selector: '.issue297m-inline-anchor', count: 0 },
  ] },
  { id: 'loop-hidden', action: '隐藏循环并渲染循环空态调用', method: 'toggleShowLoop', nodes: [
    text('.issue297m-loop-empty .issue297m-result', 'loop-hidden-row-1-tail'),
    { selector: '.issue297m-loop-row', count: 0 },
  ] },
]

function activeTab(id: string) {
  return [
    text('.issue302-active', `active: ${id}`),
    text(`.issue302-item-${id}.issue302-item-active`, id.toUpperCase()),
    { selector: '.issue302-item-inactive', count: 2 },
  ]
}

export const LOOP_CLASSES: GithubDomStep[] = [
  { id: 'initial', action: '首屏激活 A，B 和 C 保持 inactive', nodes: activeTab('a') },
  { id: 'active-b', action: '点击 B 更新循环项 class', tap: '.issue302-item-b', nodes: activeTab('b') },
  { id: 'active-c', action: '点击 C 更新循环项 class', tap: '.issue302-item-c', nodes: activeTab('c') },
  { id: 'active-a', action: '再次点击 A 恢复初始激活项', tap: '.issue302-item-a', nodes: activeTab('a') },
]
