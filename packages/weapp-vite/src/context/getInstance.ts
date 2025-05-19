import type { CompilerContext } from './CompilerContext'
import { container } from '@/inversify.config'
import { Symbols } from './Symbols'

const compilerContextMap = new Map<string, CompilerContext>()

const DEFAULT_KEY = 'default'
export function getCompilerContext(key: string = DEFAULT_KEY): CompilerContext {
  let ctx = compilerContextMap.get(key)
  if (ctx) {
    return ctx
  }
  ctx = container.get<CompilerContext>(Symbols.CompilerContext)
  compilerContextMap.set(key, ctx)
  return ctx
}
