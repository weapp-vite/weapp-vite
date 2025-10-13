import type { LoadConfigOptions } from './context'
import { getCompilerContext, resetCompilerContext, setActiveCompilerContextKey } from './context/getInstance'

export async function createCompilerContext(options?: Partial<LoadConfigOptions & { key?: string }>) {
  // 先初始化 ConfigService
  const key = options?.key ?? 'default'
  if (!options?.key) {
    // ensure callers without explicit key do not reuse stale global context
    resetCompilerContext(key)
  }
  setActiveCompilerContextKey(key)
  const ctx = getCompilerContext(key)
  const { configService, scanService, autoRoutesService } = ctx
  await configService.load(options)
  if (autoRoutesService) {
    await autoRoutesService.ensureFresh()
  }
  // prefilght
  try {
    await scanService.loadAppEntry()
  }
  catch {
    // prefilght catch
  }

  return ctx
}
