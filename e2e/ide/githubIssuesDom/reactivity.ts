import type { DomCheckpoint } from '../../utils/domAcceptance/types'
import { githubText as text } from './nodes'

const counterNames = ['count', 'explicit', 'derived', 'prefix', 'conditional', 'sequence', 'argument', 'shorthand', 'nested']

export const INLINE_ASSIGNMENT_STEPS = [
  { id: 'initial', values: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'count', tap: 'count', values: [1, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'explicit', tap: 'explicit', values: [1, 1, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'derived', tap: 'derived', values: [1, 1, 1, 0, 0, 0, 0, 0, 0] },
  { id: 'prefix', tap: 'prefix', values: [1, 1, 1, 1, 0, 0, 0, 0, 0] },
  { id: 'conditional-first', tap: 'conditional', values: [1, 1, 1, 1, 1, 0, 0, 0, 0] },
  { id: 'conditional-next', tap: 'conditional', values: [1, 1, 1, 1, 3, 0, 0, 0, 0] },
  { id: 'sequence', tap: 'sequence', values: [1, 1, 1, 1, 3, 2, 0, 0, 0] },
  { id: 'argument', tap: 'argument', values: [1, 1, 1, 1, 3, 2, 1, 0, 0] },
  { id: 'shorthand', tap: 'shorthand', values: [1, 1, 1, 1, 3, 2, 1, 1, 0] },
  { id: 'nested', tap: 'nested', values: [1, 1, 1, 1, 3, 2, 1, 1, 1] },
]

export const INLINE_ASSIGNMENT_CHECKPOINTS: DomCheckpoint[] = INLINE_ASSIGNMENT_STEPS.map(step => ({
  id: step.id,
  route: '/pages/issue-621/index',
  action: step.tap ? `点击 ${step.tap} 按钮后检查全部计数，保留其他计数状态` : '首屏检查全部计数为零',
  nodes: counterNames.flatMap((name, index) => [
    text(`.issue621-button-${name}`, `${name} ${step.values[index]}`),
    text(`.issue621-${name === 'count' ? 'count' : `${name}-count`}`, String(step.values[index])),
  ]),
}))

export function arrayFlushCheckpoint(id: string, rows: string[]): DomCheckpoint {
  return { id, route: '/pages/issue-581/index', action: `检查 ${id} 刷新后的完整列表和加载状态`, nodes: [
    text('.issue581-loading', 'loaded'),
    { selector: '.issue581-row', count: rows.length },
    ...rows.map((value, index) => text(`#issue581-row-${index}`, value)),
  ] }
}
