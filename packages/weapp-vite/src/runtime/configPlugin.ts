import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import type { OxcRuntimeSupport } from './oxcRuntime'
import { createConfigService } from './config/createConfigService'

export { createConfigService } from './config/createConfigService'

export function createConfigServicePlugin(ctx: MutableCompilerContext, oxcRuntimeSupport?: OxcRuntimeSupport): Plugin {
  const service = createConfigService(ctx, oxcRuntimeSupport)
  ctx.configService = service

  return {
    name: 'weapp-runtime:config-service',
  }
}
