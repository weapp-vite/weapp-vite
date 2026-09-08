import type { DomCheckpoint } from '../../utils/domAcceptance/types'

export function statefulHmrCheckpoints(runtime: 'native' | 'component' | 'wevu'): DomCheckpoint[] {
  const prepared = runtime === 'wevu' ? 2 : 1
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
      ...(runtime === 'wevu'
        ? [
            { selector: '.store-count', text: String(count) },
            id === 'initial' ? { selector: '.removed-field', text: 'initial' } : { selector: '.removed-field', count: 0 },
            id === 'patched' || id === 'updated' ? { selector: '.added-field', text: 'new default' } : { selector: '.added-field', count: 0 },
          ]
        : []),
      ...(runtime === 'wevu' && (id === 'patched' || id === 'updated') ? [{ selector: '.sfc-template', text: 'SFC-MIXED-TEMPLATE' }] : []),
      ...(id === 'initial' ? [{ selector: '.marker', text: `STATEFUL-${runtime.toUpperCase()}-BASE` }] : []),
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
        styles: { 'background-color': styled ? 'rgb(219, 234, 254)' : 'rgb(255, 255, 255)' },
        visible: true,
      })
    }
  }
  if (runtime === 'wevu') {
    for (const [id, count, template, styled] of [
      ['template-b', 2, 'SFC-TEMPLATE-B', false],
      ['template-a', 2, undefined, false],
      ['mixed-style', 4, 'SFC-MIXED-TEMPLATE', true],
      ['mixed-style-updated', 7, 'SFC-MIXED-TEMPLATE', true],
    ] as const) {
      checkpoints.push({
        id,
        route: '/pages/wevu/index',
        action: `SFC ${id}：检查模板、计数、输入和混合更新后的实际样式`,
        nodes: [
          { selector: '.count', text: String(count) },
          { selector: '.store-count', text: String(count) },
          { selector: '.input', attributes: { value: 'held-input' } },
          template ? { selector: '.sfc-template', text: template } : { selector: '.sfc-template', count: 0 },
          ...(styled ? [{ selector: '.page', styles: { 'background-color': 'rgb(219, 234, 254)' }, visible: true }] : []),
        ],
      })
    }
    // 模板往返发生在脚本补丁之前，验收清单必须与证据写入顺序一致。
    checkpoints.splice(2, 0, ...checkpoints.splice(4, 2))
  }
  return checkpoints
}
