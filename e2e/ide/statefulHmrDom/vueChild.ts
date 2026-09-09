import type { DomCheckpoint } from '../../utils/domAcceptance/types'
import { nativeChildCheckpoints } from './nativeChild'

export const vueChildCheckpoints: DomCheckpoint[] = nativeChildCheckpoints.map(checkpoint => ({
  ...checkpoint,
  action: `${checkpoint.id}：验收父页计数与输入、Vue 子组件响应式计数及脚本更新后的实际文本`,
  nodes: checkpoint.nodes.map(node => ({
    ...node,
    ...(node.scope ? { scope: ['#vue-counter'] } : {}),
  })),
}))
