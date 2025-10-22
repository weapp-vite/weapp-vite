import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import { createConfigService } from './config/createConfigService'

export { createConfigService } from './config/createConfigService'

export function createConfigServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createConfigService(ctx)
  ctx.configService = service

  return {
    name: 'weapp-runtime:config-service',
  }
}
