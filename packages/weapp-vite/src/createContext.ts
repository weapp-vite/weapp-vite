import type { LoadConfigOptions } from './context'
import { getCompilerContext } from './context/getInstance'

export async function createCompilerContext(options?: Partial<LoadConfigOptions & { key?: string }>) {
  // 先初始化 ConfigService
  const ctx = getCompilerContext(options?.key)
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
