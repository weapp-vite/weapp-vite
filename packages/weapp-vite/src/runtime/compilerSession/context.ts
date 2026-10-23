import type { CompilerContext } from '../../context'
import type { LoadConfigOptions } from '../config/types'
import logger from '../../logger'
import { startInitialBuildInputObservation } from '../buildPlugin/initialBuildChanges'
import { syncProjectSupportFiles } from '../supportFiles'
import { hasManagedTsconfigBootstrapCompleted, syncManagedTsconfigBootstrapFiles } from '../tsconfigSupport'

export interface InitializeCompilerContextOptions extends Partial<LoadConfigOptions> {
  syncSupportFiles?: boolean
  syncAutoImportSupportFiles?: boolean
  preloadAppEntry?: boolean
}

/** 旧构建已退出后建立新输入代次；完整 drain 仅释放自己仍持有的观察者。 */
export function restartCompilerContextInputObservation(ctx: CompilerContext): () => void {
  return startInitialBuildInputObservation(ctx.configService, ctx.watcherService)
}

async function loadCompilerContext(ctx: CompilerContext, options: InitializeCompilerContextOptions | undefined, releaseInitialBuildInputs: () => void) {
  const bootstrapManagedTsconfigPromise = !options?.hostConfig && options?.cwd && !hasManagedTsconfigBootstrapCompleted(options.cwd)
    ? Promise.resolve().then(() => syncManagedTsconfigBootstrapFiles(options.cwd!)).catch((error) => {
        const message = error instanceof Error ? error.message : String(error)
        logger.warn(`[tsconfig] 跳过 .weapp-vite 支持文件预生成：${message}`)
        return false
      })
    : Promise.resolve(false)
  const { configService, scanService } = ctx
  // 配置加载会根据托管 tsconfig 是否存在决定 Rolldown 的类型配置路径。
  // 先完成 bootstrap，避免根 tsconfig 已写入而 .weapp-vite/tsconfig.app.json 仍在落盘的窗口。
  const bootstrapManagedTsconfigChanged = await bootstrapManagedTsconfigPromise
  await configService.load(options)
  if (options?.syncSupportFiles !== false) {
    try {
      const supportFiles = await syncProjectSupportFiles(ctx, {
        syncAutoImport: options?.syncAutoImportSupportFiles,
      })
      for (const warning of supportFiles.managedTsconfigWarnings) {
        logger.warn(warning)
      }
      if (supportFiles.managedTsconfigWarnings.length === 0 && (bootstrapManagedTsconfigChanged || supportFiles.managedTsconfigChanged)) {
        logger.warn('[prepare] 检测到 .weapp-vite 支持文件缺失或已过期，已自动重新生成。建议执行 wv prepare 并提交更新。')
      }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(`[prepare] 自动同步 .weapp-vite 支持文件失败：${message}`)
    }
  }
  // 预检
  if (options?.preloadAppEntry !== false) {
    try {
      await scanService.loadAppEntry()
    }
    catch {
      releaseInitialBuildInputs()
      // 预检失败时忽略
    }
  }

  return ctx
}

/** 初始化调用方明确提供的上下文，不访问或切换进程级活动上下文。 */
export async function initializeCompilerContext(ctx: CompilerContext, options?: InitializeCompilerContextOptions) {
  await ctx.watcherService.closeAll()
  const releaseInitialBuildInputs = restartCompilerContextInputObservation(ctx)
  try {
    return await loadCompilerContext(ctx, options, releaseInitialBuildInputs)
  }
  catch (error) {
    releaseInitialBuildInputs()
    throw error
  }
}
