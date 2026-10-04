import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../../context'
import type { OxcRuntimeSupport } from '../oxcRuntime'
import { createNpmService } from './service'

export type { NpmService } from './service'

export function createNpmServicePlugin(ctx: MutableCompilerContext, oxcRuntimeSupport?: OxcRuntimeSupport): Plugin {
  const service = createNpmService(ctx, oxcRuntimeSupport)
  ctx.npmService = service

  return {
    name: 'weapp-runtime:npm-service',
  }
}
