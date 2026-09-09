import type { DomScope } from '../../utils/domAcceptance/types'
import type { GithubDomStep } from './index'
import { githubText as text } from './index'

const objectScope: DomScope[] = ['#issue289-object-example']
const mapScope: DomScope[] = [{ has: '.issue289-map-mock' }]
const rootScope: DomScope[] = [{ has: '.root-class-box' }]
const computedScope: DomScope[] = [{ has: '.computed-class-box' }]

export const OBJECT_CLASSES: GithubDomStep[] = [
  { id: 'initial', action: '首屏显示宽松列表和首个激活项', nodes: [
    text('.issue289-object-toggle-list', '列表：显示'),
    text('.issue289-object-toggle-compact', '密度：宽松'),
    text('.object-item-active .object-item-label', '对象字面量入口', objectScope),
    { selector: '.object-list-loose .object-item', scope: objectScope, count: 3 },
  ] },
  { id: 'hidden', action: '隐藏列表并显示 empty 分支', tap: '.issue289-object-toggle-list', nodes: [
    text('#issue289-object-empty.object-empty-loose', 'object list hidden', objectScope),
    { selector: '.object-item', scope: objectScope, count: 0 },
  ] },
  { id: 'restored', action: '恢复三个列表项', tap: '.issue289-object-toggle-list', nodes: [
    text('.issue289-object-toggle-list', '列表：显示'),
    { selector: '.object-item', scope: objectScope, count: 3 },
    { selector: '#issue289-object-empty', scope: objectScope, count: 0 },
  ] },
  { id: 'compact', action: '切换紧凑 class', tap: '.issue289-object-toggle-compact', nodes: [
    text('.issue289-object-toggle-compact', '密度：紧凑'),
    { selector: '.object-list-compact .object-item', scope: objectScope, count: 3 },
  ] },
  { id: 'active', action: '激活第二项并切换 warning badge', tap: '.issue289-object-cycle-active', nodes: [
    text('.issue289-object-cycle-active', '激活项：item-1'),
    text('.object-item-active .object-item-label', '类名绑定分支', objectScope),
    text('.object-item-badge-warning', 'active', objectScope),
    { selector: '.object-item-idle', scope: objectScope, count: 2 },
  ] },
]

export const MAP_CLASSES: GithubDomStep[] = [
  { id: 'initial', action: '首屏显示展开活动气泡和选中的内部活动', nodes: [
    text('.issue289-map-toggle-expanded.issue289-ctrl-on', '气泡尺寸：展开'),
    text('.event-chip-theme.event-chip-expanded', '内部活动-1', mapScope),
    { selector: '.event-chip', scope: mapScope, count: 2 },
  ] },
  { id: 'collapsed', action: '收起气泡并保留活动列表', tap: '.issue289-map-toggle-expanded', nodes: [
    text('.issue289-map-toggle-expanded.issue289-ctrl-off', '气泡尺寸：收起'),
    text('.event-chip-theme.event-chip-collapsed', '内部活动-1', mapScope),
    { selector: '.event-chip-collapsed', scope: mapScope, count: 2 },
  ] },
  { id: 'selected', action: '切换为公开活动并更新高亮 class', tap: '.issue289-map-cycle-selected', nodes: [
    text('.issue289-map-cycle-selected.issue289-cycle-0', '选中事件：0'),
    text('.event-chip-highlight', '公开活动-0', mapScope),
    { selector: '.event-chip-theme', scope: mapScope, count: 0 },
  ] },
  { id: 'hidden', action: '隐藏活动列表并显示空态', tap: '.issue289-map-toggle-list', nodes: [
    text('.issue289-map-toggle-list.issue289-ctrl-off', '气泡列表：隐藏'),
    text('.map-meta-empty', 'callout hidden', mapScope),
    { selector: '.event-chip', scope: mapScope, count: 0 },
  ] },
]

export const ROOT_CLASSES: GithubDomStep[] = [
  { id: 'initial', action: '首屏应用主样式并显示三个选项', nodes: [
    text('#issue289-root-class-value.aaaa', 'root class: aaaa', rootScope),
    text('.root-option-active', '主样式', rootScope),
    { selector: '.root-option', scope: rootScope, count: 3 },
  ] },
  { id: 'selected', action: '切换次样式并更新根 class', tap: '.issue289-root-cycle-option', nodes: [
    text('.issue289-root-cycle-option', '选中类：root-b'),
    text('#issue289-root-class-value.bbbb', 'root class: bbbb', rootScope),
    text('.root-option-active', '次样式', rootScope),
  ] },
  { id: 'hidden', action: '隐藏选项并保留已选根样式', tap: '.issue289-root-toggle-options', nodes: [
    text('#issue289-root-class-value.bbbb', 'root class: bbbb', rootScope),
    text('.root-options-tip', 'options hidden', rootScope),
    { selector: '.root-option', scope: rootScope, count: 0 },
  ] },
]

export const COMPUTED_CLASSES: GithubDomStep[] = [
  { id: 'initial', action: '首屏渲染计算 class a 和三个候选项', nodes: [
    text('#issue289-computed-main.a', 'computed class: a', computedScope),
    text('.computed-item-active', '计算类名 a', computedScope),
    { selector: '.computed-list-enabled .computed-item', scope: computedScope, count: 3 },
  ] },
  { id: 'source', action: '切换 source 并更新计算 class 和匹配项', tap: '.issue289-computed-toggle-source', nodes: [
    text('.issue289-computed-toggle-source.issue289-ctrl-off', 'source：false'),
    text('#issue289-computed-main.b', 'computed class: b', computedScope),
    text('.computed-item-match', '计算类名 b', computedScope),
  ] },
  { id: 'selected', action: '选中第二项并检查 active 与 match 同时成立', tap: '.issue289-computed-cycle-selected', nodes: [
    text('.computed-item-active.computed-item-match', '计算类名 b', computedScope),
    { selector: '.computed-item-idle', scope: computedScope, count: 2 },
  ] },
  { id: 'hidden', action: '隐藏列表并渲染计算分支 b 的空态', tap: '.issue289-computed-toggle-items', nodes: [
    text('.computed-empty-b', 'computed list hidden', computedScope),
    { selector: '.computed-item', scope: computedScope, count: 0 },
  ] },
]
