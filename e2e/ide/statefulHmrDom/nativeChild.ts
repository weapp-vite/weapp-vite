import type { DomCheckpoint } from '../../utils/domAcceptance/types'

export const nativeChildCheckpoints: DomCheckpoint[] = [
  ['initial', 0, 0, '', 'ready'],
  ['prepared', 1, 1, 'held-input', 'step:1'],
  ['patched', 1, 1, 'held-input', 'step:1'],
  ['updated', 1, 3, 'held-input', 'step:2'],
  ['restored', 1, 3, 'held-input', 'step:2'],
  ['restored-interaction', 2, 4, 'held-input', 'step:1'],
].map(([id, parent, child, input, result]) => ({
  id: String(id),
  route: '/pages/component/index',
  action: `${id}：验收父页计数与输入、子组件计数及最新递增逻辑的实际文本`,
  nodes: [
    { selector: '.parent-count', text: String(parent) },
    { selector: '.input', attributes: { value: String(input) } },
    { selector: '.child-count', scope: ['#native-counter'], text: String(child) },
    { selector: '.child-result', scope: ['#native-counter'], text: String(result) },
  ],
}))
