import type { DomCheckpoint } from '../../utils/domAcceptance/types'

export function statefulHmrCheckpoints(runtime: 'native' | 'component' | 'wevu'): DomCheckpoint[] {
  const prepared = runtime === 'wevu' ? 2 : 1
  return [
    ['initial', 0, '', '首屏检查初始计数、输入和标记'],
    ['prepared', prepared, 'held-input', '输入文本并点击按钮，检查交互状态'],
    ['patched', prepared, 'held-input', '应用脚本补丁后检查已输入文本和计数保留'],
    ['updated', prepared + 2, 'held-input', '执行更新后的递增逻辑，检查增量为二'],
  ].map(([id, count, input, action]) => ({
    id: String(id),
    route: `/pages/${runtime}/index`,
    action: String(action),
    nodes: [
      { selector: '.count', text: String(count) },
      { selector: '.input', attributes: { value: String(input) } },
      ...(runtime === 'wevu'
        ? [
            { selector: '.store-count', text: String(count) },
            id === 'initial' ? { selector: '.removed-field', text: 'initial' } : { selector: '.removed-field', count: 0 },
            id === 'patched' || id === 'updated' ? { selector: '.added-field', text: 'new default' } : { selector: '.added-field', count: 0 },
          ]
        : []),
      ...(id === 'initial' ? [{ selector: '.marker', text: `STATEFUL-${runtime.toUpperCase()}-BASE` }] : []),
    ],
  }))
}
