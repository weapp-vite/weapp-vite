import type { DomCheckpoint } from '../../utils/domAcceptance/types'

/** 验证模板生成的计算绑定和事件表随补丁更新，并在恢复后移除。 */
export function templateBindingCheckpoints(): DomCheckpoint[] {
  return [
    ['initial', 0, undefined],
    ['prepared', 2, undefined],
    ['edited', 2, 21],
    ['clicked', 4, 41],
    ['restored', 4, undefined],
    ['original-clicked', 5, undefined],
  ].map(([id, count, derived]) => ({
    id: String(id),
    route: '/pages/wevu/index',
    action: `Wevu ${id}：检查新增模板表达式和事件处理，以及恢复后的状态`,
    nodes: [
      { selector: '.count', text: String(count) },
      { selector: '.input', attributes: { value: id === 'initial' ? '' : 'held-input' } },
      { selector: '.marker', text: 'STATEFUL-WEVU-BASE' },
      derived === undefined
        ? { selector: '.derived-count', count: 0 }
        : { selector: '.derived-count', text: String(derived) },
      { selector: '.derived-increment', count: derived === undefined ? 0 : 1 },
    ],
  }))
}
