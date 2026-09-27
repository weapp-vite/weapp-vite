import type { DevframeDefinition } from 'devframe'
import { defineRpcFunction } from 'devframe'

const rejectDashboardSharedStateSet = defineRpcFunction({
  name: 'devframe:rpc:server-state:set',
  type: 'action',
  handler: (): void => {
    throw new Error('Dashboard Devframe shared state 只允许服务端修改。')
  },
})
const rejectDashboardSharedStatePatch = defineRpcFunction({
  name: 'devframe:rpc:server-state:patch',
  type: 'action',
  handler: (): void => {
    throw new Error('Dashboard Devframe shared state 只允许服务端修改。')
  },
})

/** 独立宿主在开放 RPC 前禁止全局共享状态写入，不影响嵌入宿主的策略。 */
export function withStandaloneDashboardPolicy(definition: DevframeDefinition): DevframeDefinition {
  return {
    ...definition,
    async setup(ctx, info) {
      ctx.rpc.register(rejectDashboardSharedStateSet, true)
      ctx.rpc.register(rejectDashboardSharedStatePatch, true)
      await definition.setup?.(ctx, info)
    },
  }
}
