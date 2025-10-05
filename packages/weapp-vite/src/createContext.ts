import type { LoadConfigOptions } from './context'
import { getCompilerContext, resetCompilerContext } from './context/getInstance'

export async function createCompilerContext(options?: Partial<LoadConfigOptions & { key?: string }>) {
  // 先初始化 ConfigService
  const key = options?.key ?? 'default'
  if (!options?.key) {
    // ensure callers without explicit key do not reuse stale global context
    resetCompilerContext(key)
  }
  const ctx = getCompilerContext(key)
  const { configService, scanService } = ctx
  await configService.load(options)
  // prefilght
  try {
    await scanService.loadAppEntry()
  }
  catch {
    // prefilght catch
  }

  return ctx
}
