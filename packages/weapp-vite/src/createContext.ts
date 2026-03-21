import type { LoadConfigOptions } from './runtime/config/types'
import { getCompilerContext, resetCompilerContext, setActiveCompilerContextKey } from './context/getInstance'
import logger from './logger'
import { syncProjectSupportFiles } from './runtime/supportFiles'
import { syncManagedTsconfigBootstrapFiles } from './runtime/tsconfigSupport'

interface CreateCompilerContextOptions extends Partial<LoadConfigOptions> {
  key?: string
  syncSupportFiles?: boolean
}

/**
 * @description 创建并初始化编译上下文（加载配置、扫描入口）
 */
export async function createCompilerContext(options?: CreateCompilerContextOptions) {
  let bootstrapManagedTsconfigChanged = false
  if (options?.cwd) {
    try {
      bootstrapManagedTsconfigChanged = await syncManagedTsconfigBootstrapFiles(options.cwd)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(`[tsconfig] 跳过 .weapp-vite 支持文件预生成：${message}`)
    }
  }
  // 先初始化 ConfigService
  const key = options?.key ?? 'default'
  if (!options?.key) {
    // 确保未显式传入 key 的调用方不会复用旧的全局上下文
    resetCompilerContext(key)
  }
  setActiveCompilerContextKey(key)
  const ctx = getCompilerContext(key)
  const { configService, scanService } = ctx
  await configService.load(options)
  if (options?.syncSupportFiles !== false) {
    try {
      const supportFiles = await syncProjectSupportFiles(ctx)
      if (bootstrapManagedTsconfigChanged || supportFiles.managedTsconfigChanged) {
        logger.warn('[prepare] 检测到 .weapp-vite 支持文件缺失或已过期，已自动重新生成。建议执行 weapp-vite prepare 并提交更新。')
      }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(`[prepare] 自动同步 .weapp-vite 支持文件失败：${message}`)
    }
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
