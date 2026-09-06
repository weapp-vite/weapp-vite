import type { DomCheckpoint, DomNodeExpectation, DomScope } from '../../utils/domAcceptance/types'

function probe(scope: DomScope[], id: string, value: string): DomNodeExpectation {
  return { selector: '.issue558-result', text: value, scope: [...scope, { has: id }, id] }
}

export const AUGMENTED_SLOT_CHECKPOINTS: DomCheckpoint[] = [
  { id: 'plain', action: '检查普通默认插槽中的 owner 函数结果', nodes: [probe(['#issue558-plain-host'], '#issue558-plain', '987654321')] },
  { id: 'named', action: '检查 header、显式 default 和 scoped footer 三种投影', nodes: [
    probe(['#issue558-named-host'], '#issue558-header', 'redaeh'),
    probe(['#issue558-named-host'], '#issue558-default', 'tluafed'),
    probe(['#issue558-named-host'], '#issue558-footer', 'retoof-987654321'),
  ] },
  { id: 'scoped', action: '检查默认 scoped-slot 的字符串和数字参数', nodes: [probe(['#issue558-scoped-host'], '#issue558-scoped', '987654321-2-tluafed-depocs')] },
  { id: 'list', action: '检查重复 scoped-slot 各自的参数和 owner 值', nodes: [
    probe(['#issue558-list-host'], '#issue558-list-0', '987654321-0-ahpla'),
    probe(['#issue558-list-host'], '#issue558-list-1', '987654321-1-ateb'),
  ] },
  { id: 'nested', action: '检查两层默认插槽中各自的 owner 函数结果', nodes: [
    probe(['#issue558-nested-group'], '#issue558-outer', 'retuo'),
    probe(['#issue558-nested-group', { has: '#issue558-nested-cell' }, '#issue558-nested-cell'], '#issue558-inner', 'detsen'),
  ] },
].map(checkpoint => ({ ...checkpoint, route: '/pages/issue-558/index' }))
