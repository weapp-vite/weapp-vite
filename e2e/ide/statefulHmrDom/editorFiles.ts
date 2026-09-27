import type { DomCheckpoint } from '../../utils/domAcceptance/types'

/** 无关编辑器文件与两轮脚本往返都需保留页面已输入的状态和递增语义。 */
export function editorFileCheckpoints(): DomCheckpoint[] {
  return [
    ['initial', 0, '', '检查初始页面和数据'],
    ['ignored', 0, 'held-input', '创建普通与隐藏临时文件后检查页面状态保持'],
    ['cycle-0-step-2', 2, 'held-input', '第一轮编辑后点击按钮，检查加二且输入保留'],
    ['cycle-0-step-1', 3, 'held-input', '第一轮恢复后点击按钮，检查加一且输入保留'],
    ['cycle-1-step-2', 5, 'held-input', '第二轮编辑后检查新逻辑和页面状态'],
    ['cycle-1-step-1', 6, 'held-input', '第二轮恢复后检查原逻辑和页面状态'],
  ].map(([id, count, input, action]) => ({
    id: String(id),
    route: '/pages/native/index',
    action: String(action),
    nodes: [
      { selector: '.count', text: String(count) },
      { selector: '.input', attributes: { value: String(input) } },
      { selector: '.marker', text: 'STATEFUL-NATIVE-BASE' },
    ],
  }))
}
