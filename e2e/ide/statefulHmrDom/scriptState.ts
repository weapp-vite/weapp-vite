import type { DomCheckpoint } from '../../utils/domAcceptance/types'

/** 独立检查脚本更新与恢复，避免前置模板失败遮挡状态保持回归。 */
export function scriptStateCheckpoints(): DomCheckpoint[] {
  return [
    ['initial', 0, false],
    ['prepared', 2, false],
    ['patched', 2, true],
    ['clicked', 4, true],
    ['restored', 4, false],
    ['restored-clicked', 5, false],
    ['navigated', 0, true],
    ['navigated-clicked', 2, true],
    ['navigated-restored', 2, false],
  ].map(([id, count, patched]) => ({
    id: String(id),
    route: '/pages/wevu/index',
    action: `Wevu ${id}：检查脚本事件、输入和可见状态`,
    nodes: [
      { selector: '.count', text: String(count) },
      { selector: '.input', attributes: { value: id === 'initial' || String(id).startsWith('navigated') ? '' : 'held-input' } },
      { selector: '.marker', text: patched ? 'STATEFUL-WEVU-PATCHED' : 'STATEFUL-WEVU-BASE' },
      { selector: '.store-count', count: 1 },
    ],
  }))
}
