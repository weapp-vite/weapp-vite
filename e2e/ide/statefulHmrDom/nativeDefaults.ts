import type { DomCheckpoint } from '../../utils/domAcceptance/types'

/** 先更新两个页面模板，再验证重新进入旧页面时默认值、点击及恢复后的渲染。 */
export function nativeDefaultCheckpoints(): DomCheckpoint[] {
  return [
    ...(['native', 'component'] as const).flatMap(runtime => [true, false].map(edited => ({
      id: `${runtime}-${edited ? 'edited' : 'restored'}`,
      route: `/pages/${runtime}/index`,
      action: `验证 ${runtime} 模板${edited ? '编辑' : '恢复'}后仍可渲染`,
      nodes: [
        { selector: '.default-template', count: edited ? 1 : 0 },
        { selector: '.count', text: '0' },
      ],
    }))),
    ...([['new-defaults', 7], ['incremented', 8], ['active-restored', 8], ['restored-defaults', 0]] as const).map(([id, count]) => ({
      id,
      route: '/pages/native/index',
      action: `验证 ${id} 时默认值及原生点击渲染`,
      nodes: [
        { selector: '.count', text: String(count) },
        { selector: '.marker', text: 'STATEFUL-NATIVE-BASE' },
      ],
    })),
  ]
}
