import type { InitializeCompilerContextOptions } from './runtime/compilerSession/context'
import { getCompilerContext, resetCompilerContext, setActiveCompilerContextKey } from './context/getInstance'
import { initializeCompilerContext } from './runtime/compilerSession/context'

interface CreateCompilerContextOptions extends InitializeCompilerContextOptions {
  key?: string
}

/** 保留历史活动上下文适配；新宿主通过 CompilerSession 创建独立会话。 */
export async function createCompilerContext(options?: CreateCompilerContextOptions) {
  const key = options?.key ?? 'default'
  if (!options?.key) {
    resetCompilerContext(key)
  }
  setActiveCompilerContextKey(key)
  return initializeCompilerContext(getCompilerContext(key), options)
}
