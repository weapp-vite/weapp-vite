import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import {
  createAutoImportService,
} from './autoImport/service'

export type {
  AutoImportMatch,
  AutoImportService,
  LocalAutoImportMatch,
  ResolverAutoImportMatch,
} from './autoImport/service'

export function createAutoImportServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createAutoImportService(ctx)
  ctx.autoImportService = service

  return {
    name: 'weapp-runtime:auto-import-service',
  }
}
