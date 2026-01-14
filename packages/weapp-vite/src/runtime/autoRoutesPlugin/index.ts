import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../../context'
import { collectCandidates } from './candidates'
import { createAutoRoutesService } from './service'

export type { AutoRoutesService } from './service'
export { createAutoRoutesService } from './service'
export type { AutoRoutesFileEvent } from './watch'

export function createAutoRoutesServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createAutoRoutesService(ctx)
  ctx.autoRoutesService = service

  return {
    name: 'weapp-runtime:auto-routes-service',
  }
}

export { collectCandidates as _collectAutoRouteCandidates }
