import type { LoadConfigOptions } from './runtime/config/types'
import { getCompilerContext, resetCompilerContext, setActiveCompilerContextKey } from './context/getInstance'

export async function createCompilerContext(options?: Partial<LoadConfigOptions & { key?: string }>) {
  // 先初始化 ConfigService
  const key = options?.key ?? 'default'
  if (!options?.key) {
    // 确保未显式传入 key 的调用方不会复用旧的全局上下文
    resetCompilerContext(key)
  }
  setActiveCompilerContextKey(key)
  const ctx = getCompilerContext(key)
  const { configService, scanService, autoRoutesService } = ctx
  await configService.load(options)
  if (autoRoutesService) {
    await autoRoutesService.ensureFresh()
  }
  // 预检
  try {
    await scanService.loadAppEntry()
  }
  catch {
    // 预检失败时忽略
  }

  return ctx
}
