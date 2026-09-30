import type { AcceptanceOptions } from '@weapp-vite/acceptance'
import { createRuntimeAcceptanceService } from '@weapp-vite/mcp'
import { connectMiniProgram, prepareAcceptanceProject } from 'weapp-ide-cli'

export * from '@weapp-vite/acceptance'
export const AcceptanceService = {
  create: (root: string, options?: AcceptanceOptions) => createRuntimeAcceptanceService(root, options, { connectMiniProgram, prepareProject: prepareAcceptanceProject }),
}
// eslint-disable-next-line ts/no-redeclare -- 同名类型用于保持原有服务接口。
export type AcceptanceService = Awaited<ReturnType<typeof AcceptanceService.create>>
