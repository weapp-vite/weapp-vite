import type { DomCheckpoint } from '../../utils/domAcceptance/types'

/** 模板独立往返只要求结构和状态，便于在两个 provider 上对照。 */
export function templateCycleCheckpoints(runtime: 'native' | 'component' | 'wevu'): DomCheckpoint[] {
  return [
    ['initial', 0, '', undefined],
    ['prepared', 2, 'held-input', undefined],
    ['edit-0', 2, 'held-input', 'TEMPLATE-CYCLE-0'],
    ['restore-0', 2, 'held-input', undefined],
    ['edit-1', 2, 'held-input', 'TEMPLATE-CYCLE-1'],
    ['restore-1', 2, 'held-input', undefined],
  ].map(([id, count, input, template]) => ({
    id: String(id),
    route: `/pages/${runtime}/index`,
    action: `${runtime} ${id}：检查模板新增节点、计数和输入保持`,
    nodes: [
      { selector: '.count', text: String(count) },
      { selector: '.input', attributes: { value: String(input) } },
      { selector: '.marker', text: `STATEFUL-${runtime.toUpperCase()}-BASE` },
      template
        ? { selector: '.template-cycle', text: String(template) }
        : { selector: '.template-cycle', count: 0 },
    ],
  }))
}
