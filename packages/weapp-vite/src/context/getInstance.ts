import type { CompilerContext } from './CompilerContext'
import { createCompilerContextInstance } from './createCompilerContextInstance'

const compilerContextMap = new Map<string, CompilerContext>()

const DEFAULT_KEY = 'default'
let activeCompilerContextKey = DEFAULT_KEY

export function setActiveCompilerContextKey(key: string) {
  activeCompilerContextKey = key
}

export function getActiveCompilerContextKey() {
  return activeCompilerContextKey
}

export function createCompilerContext(key: string = DEFAULT_KEY): CompilerContext {
  const ctx = createCompilerContextInstance()
  compilerContextMap.set(key, ctx)
  setActiveCompilerContextKey(key)
  return ctx
}

export function getCompilerContext(key: string = activeCompilerContextKey): CompilerContext {
  let ctx = compilerContextMap.get(key)
  if (!ctx) {
    ctx = createCompilerContextInstance()
    compilerContextMap.set(key, ctx)
    setActiveCompilerContextKey(key)
  }
  return ctx
}

export function resetCompilerContext(key?: string) {
  if (key) {
    compilerContextMap.delete(key)
    if (activeCompilerContextKey === key) {
      activeCompilerContextKey = DEFAULT_KEY
    }
    return
  }
  compilerContextMap.clear()
  activeCompilerContextKey = DEFAULT_KEY
}
