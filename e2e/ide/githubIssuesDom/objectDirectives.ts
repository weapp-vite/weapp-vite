import type { GithubDomStep } from './index'
import { githubText as text } from './index'

export const OBJECT_DIRECTIVE_CONTROLS: GithubDomStep[] = [
  {
    id: 'explicit-control-initial',
    action: '检查对象形式仅保留诊断语义，显式属性和事件对照正常渲染',
    nodes: [
      text('#issue1014-title', 'issue 1014 object directives'),
      {
        selector: '#issue1014-explicit-control',
        attributes: { 'data-title': 'unsupported-object-title' },
      },
      text('#issue1014-explicit-count', '0'),
    ],
  },
  {
    id: 'explicit-control-tapped',
    action: '触发显式 tap 事件并检查响应式计数只增加一次',
    tap: '#issue1014-explicit-control',
    nodes: [
      text('#issue1014-explicit-count', '1'),
    ],
  },
]
