import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../../context'
import { createScanService } from './service'

export type { ScanService } from './service'

export function createScanServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createScanService(ctx)
  ctx.scanService = service

  return {
    name: 'weapp-runtime:scan-service',
    async buildStart() {
      const configService = ctx.configService
      if (configService?.weappLibConfig?.enabled) {
        return
      }
      await service.loadAppEntry()
      service.loadSubPackages()
    },
  }
}
