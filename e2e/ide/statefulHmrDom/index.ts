import type { DomCheckpoint, DomProvider } from '../../utils/domAcceptance/types'

export function statefulHmrCheckpoints(runtime: 'native' | 'component', provider: DomProvider = 'devtools'): DomCheckpoint[] {
  const prepared = 1
  const checkpoints: DomCheckpoint[] = [
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
      { selector: '.marker', text: `STATEFUL-${runtime.toUpperCase()}-BASE` },
    ],
  }))
  if (runtime === 'native') {
    for (const [id, count] of [['restored', 3], ['restored-updated', 4]] as const) {
      checkpoints.push({
        id,
        route: '/pages/native/index',
        action: id === 'restored' ? '恢复脚本，检查背景不变和交互状态保留' : '执行恢复后的加一逻辑，检查计数和输入',
        nodes: [
          { selector: '.count', text: String(count) },
          { selector: '.input', attributes: { value: 'held-input' } },
        ],
      })
    }
    for (const checkpoint of checkpoints) {
      checkpoint.nodes.push({
        selector: '.page',
        ...(provider === 'devtools'
          ? {
              styles: { 'background-color': 'rgb(255, 255, 255)' },
              visible: true,
            }
          : {}),
      })
    }
  }
  return checkpoints
}
