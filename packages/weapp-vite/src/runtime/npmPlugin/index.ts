import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../../context'
import { createNpmService } from './service'

export type { NpmService } from './service'

export function createNpmServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createNpmService(ctx)
  ctx.npmService = service

  return {
    name: 'weapp-runtime:npm-service',
  }
}
