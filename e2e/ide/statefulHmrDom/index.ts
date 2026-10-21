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
    checkpoints.splice(2, 0, {
      id: 'style-updated',
      route: '/pages/native/index',
      action: '先更新邻接 WXSS，检查实际背景变化且页面计数和输入保留',
      nodes: [
        { selector: '.count', text: '1' },
        { selector: '.input', attributes: { value: 'held-input' } },
      ],
    })
    for (const [id, count] of [['restored', 3], ['restored-updated', 4]] as const) {
      checkpoints.push({
        id,
        route: '/pages/native/index',
        action: id === 'restored' ? '恢复脚本与 WXSS，检查原背景和交互状态' : '执行恢复后的加一逻辑，检查计数和输入',
        nodes: [
          { selector: '.count', text: String(count) },
          { selector: '.input', attributes: { value: 'held-input' } },
        ],
      })
    }
    for (const checkpoint of checkpoints) {
      const styled = ['style-updated', 'patched', 'updated'].includes(checkpoint.id)
      checkpoint.nodes.push({
        selector: '.page',
        ...(provider === 'devtools'
          ? {
              styles: { 'background-color': styled ? 'rgb(219, 234, 254)' : 'rgb(255, 255, 255)' },
              visible: true,
            }
          : {}),
      })
    }
  }
  return checkpoints
}
