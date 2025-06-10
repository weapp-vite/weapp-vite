import type { CompilerContext } from '@/context/CompilerContext'

export interface WeappVitePluginApi {
  ctx: CompilerContext
}

export type ChangeEvent = 'create' | 'update' | 'delete'
