import type { LoadConfigOptions } from './context/loadConfig'
import process from 'node:process'
import { defu } from '@weapp-core/shared'
import { CompilerContext } from './context/CompilerContext'
import { loadConfig } from './context/loadConfig'

export {
  CompilerContext,
}

export async function createCompilerContext(options: Partial<LoadConfigOptions>) {
  const opts = defu<LoadConfigOptions, LoadConfigOptions[]>(options, {
    cwd: process.cwd(),
    isDev: false,
    mode: 'development',
  })
  const opt = await loadConfig(opts)
  const ctx: CompilerContext = new CompilerContext(opt)
  return ctx
}
