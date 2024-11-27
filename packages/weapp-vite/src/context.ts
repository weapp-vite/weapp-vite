import type { CompilerContextOptions } from './types'
import { defu } from '@weapp-core/shared'
import { CompilerContext } from './context/CompilerContext'

export interface CreateCompilerContextOptions {
  loadConfig?: boolean
}

export {
  CompilerContext,
}

export async function createCompilerContext(options?: CompilerContextOptions, opts?: CreateCompilerContextOptions) {
  const { loadConfig } = defu<CreateCompilerContextOptions, CreateCompilerContextOptions[]>(opts, { loadConfig: true })
  const ctx: CompilerContext = new (CompilerContext as any) (options)
  if (loadConfig) {
    await ctx.loadDefaultConfig()
  }
  return ctx
}
