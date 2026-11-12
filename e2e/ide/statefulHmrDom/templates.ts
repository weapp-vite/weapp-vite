import type { DomCheckpoint } from '../../utils/domAcceptance/types'

/** 模板变更触发完整重载，两个 provider 核对相同节点与重置后的状态。 */
export function templateCycleCheckpoints(runtime: 'native' | 'component'): DomCheckpoint[] {
  return [
    ['initial', 0, '', undefined],
    ['prepared', 2, 'held-input', undefined],
    ['edit-0', 0, '', 'TEMPLATE-CYCLE-0'],
    ['restore-0', 0, '', undefined],
    ['edit-1', 0, '', 'TEMPLATE-CYCLE-1'],
    ['restore-1', 0, '', undefined],
  ].map(([id, count, input, template]) => ({
    id: String(id),
    route: `/pages/${runtime}/index`,
    action: `${runtime} ${id}：检查模板新增节点、完整重载后的计数和输入`,
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
