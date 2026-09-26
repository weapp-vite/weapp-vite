import type { DomCheckpoint } from '../../utils/domAcceptance/types'
import { githubText as text } from './nodes'

export const ISSUE553: DomCheckpoint[] = [
  ['initial', 'abc-seed', 'model-seed'],
  ['abc', 'abc-from-child', 'model-seed'],
  ['model', 'abc-from-child', 'model-from-child'],
].map(([id, abc, model]) => ({
  id: id!,
  route: '/pages/issue-553/index',
  action: `检查 ${id} 阶段两个 model 在父子组件中的值`,
  nodes: [
    text('.issue553-parent-abc', `parent abc = ${abc}`),
    text('.issue553-parent-model', `parent model = ${model}`),
    text('.issue553-child-abc', `child abc = ${abc}`, ['#issue553-probe']),
    text('.issue553-child-model', `child model = ${model}`, ['#issue553-probe']),
  ],
}))

export const ISSUE555: DomCheckpoint[] = ['initial', 'hidden', 'restored'].map(id => ({
  id,
  route: '/pages/issue-555/index',
  action: `检查条件插槽 ${id} 阶段的节点出现和消失`,
  nodes: [
    text('.issue555-action', 'toggle issue-555 value'),
    id === 'hidden' ? { selector: '.issue555-text-probe', count: 0 } : text('.issue555-text-probe', 'issue-555 conditional slot text'),
  ],
}))
