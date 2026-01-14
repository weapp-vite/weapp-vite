import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../../context'
import { createBuildService } from './service'

export type { BuildOptions, BuildService } from './service'

export function createBuildServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createBuildService(ctx)
  ctx.buildService = service

  return {
    name: 'weapp-runtime:build-service',
  }
}
