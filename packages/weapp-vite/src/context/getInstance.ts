import type { CompilerContext } from './CompilerContext'
import { createCompilerContextInstance } from './createCompilerContextInstance'

const compilerContextMap = new Map<string, CompilerContext>()

const DEFAULT_KEY = 'default'

export function createCompilerContext(key: string = DEFAULT_KEY): CompilerContext {
  const ctx = createCompilerContextInstance()
  compilerContextMap.set(key, ctx)
  return ctx
}

export function getCompilerContext(key: string = DEFAULT_KEY): CompilerContext {
  let ctx = compilerContextMap.get(key)
  if (!ctx) {
    ctx = createCompilerContextInstance()
    compilerContextMap.set(key, ctx)
  }
  return ctx
}

export function resetCompilerContext(key?: string) {
  if (key) {
    compilerContextMap.delete(key)
    return
  }
  compilerContextMap.clear()
}
