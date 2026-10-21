import type { DomCheckpoint, DomProvider } from '../../utils/domAcceptance/types'

interface TemplateCheckpoint {
  id: string
  count?: number
  store?: number
  input?: string
  marker?: string
  template?: string
  cycle?: string
  derived?: number
  added?: boolean
  styled?: boolean
}

/** 编译模板注册变化必须由 classic 冷重载建立新节点、绑定及事件，不再要求保留旧实例。 */
export function templateFallbackCheckpoints(kind: 'mixed' | 'bindings' | 'cycles' | 'external', provider: DomProvider): DomCheckpoint[] {
  const initial: TemplateCheckpoint[] = [
    { id: 'initial', ...(kind === 'mixed' ? { store: 0 } : {}) },
    { id: 'prepared', count: 2, input: 'held-input', ...(kind === 'mixed' ? { store: 2 } : {}) },
  ]
  const steps: TemplateCheckpoint[] = kind === 'mixed'
    ? [
        { id: 'template-b', store: 0, template: 'SFC-TEMPLATE-B' },
        { id: 'template-a', store: 0 },
        { id: 'patched', store: 0, marker: 'STATEFUL-WEVU-PATCHED', template: 'SFC-MIXED-TEMPLATE', added: true },
        { id: 'updated', count: 2, store: 2, marker: 'STATEFUL-WEVU-PATCHED', template: 'SFC-MIXED-TEMPLATE', added: true },
        { id: 'mixed-style', store: 0, marker: 'STATEFUL-WEVU-PATCHED', template: 'SFC-MIXED-TEMPLATE', added: true, styled: true },
        { id: 'mixed-style-updated', count: 3, store: 3, marker: 'STATEFUL-WEVU-PATCHED', template: 'SFC-MIXED-TEMPLATE', added: true, styled: true },
        { id: 'restored', store: 0 },
        { id: 'original-clicked', count: 1, store: 1 },
      ]
    : kind === 'cycles'
      ? [
          { id: 'edit-0', store: 0, cycle: 'TEMPLATE-CYCLE-0' },
          { id: 'restore-0', store: 0 },
          { id: 'edit-1', store: 0, cycle: 'TEMPLATE-CYCLE-1' },
          { id: 'restore-1', store: 0 },
        ]
      : [
          { id: 'edited', store: 0, derived: 1, ...(kind === 'external' ? { template: 'EXTERNAL-TEMPLATE' } : {}) },
          { id: 'clicked', count: 2, store: 0, derived: 21, ...(kind === 'external' ? { template: 'EXTERNAL-TEMPLATE' } : {}) },
          { id: 'restored', store: 0 },
          { id: 'original-clicked', count: 1, store: 1 },
        ]
  return [...initial, ...steps].map(step => ({
    id: step.id,
    route: '/pages/wevu/index',
    action: `${kind} ${step.id}：检查 classic 自动重载后的节点、输入、计算绑定、事件与默认字段`,
    nodes: [
      { selector: '.count', text: String(step.count ?? 0) },
      { selector: '.input', attributes: { value: step.input ?? '' } },
      { selector: '.marker', text: step.marker ?? 'STATEFUL-WEVU-BASE' },
      ...(step.store === undefined ? [] : [{ selector: '.store-count', text: String(step.store) }]),
      // inline 模板事件只改 count；初始默认字段直到原 increment 执行后才删除。
      (step.count ?? 0) === 0 || step.id === 'clicked'
        ? { selector: '.removed-field', text: 'initial' }
        : { selector: '.removed-field', count: 0 },
      step.added ? { selector: '.added-field', text: 'new default' } : { selector: '.added-field', count: 0 },
      step.template ? { selector: '.sfc-template', text: step.template } : { selector: '.sfc-template', count: 0 },
      step.cycle ? { selector: '.template-cycle', text: step.cycle } : { selector: '.template-cycle', count: 0 },
      step.derived === undefined ? { selector: '.derived-count', count: 0 } : { selector: '.derived-count', text: String(step.derived) },
      { selector: '.derived-increment', count: step.derived === undefined ? 0 : 1 },
      ...(step.styled
        ? [{
            selector: '.page',
            ...(provider === 'devtools' ? { styles: { 'background-color': 'rgb(219, 234, 254)' }, visible: true } : {}),
          }]
        : []),
    ],
  }))
}
