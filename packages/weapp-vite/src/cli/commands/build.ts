import type { CAC } from 'cac'
import type { ChildProcess } from 'node:child_process'
import type { AnalyzeDashboardHandle } from '../analyze/dashboard'
import type { GlobalCLIOptions } from '../types'
import process from 'node:process'
import { analyzeSubpackages } from '../../analyze/subpackages'
import { createCompilerContext } from '../../createContext'
import logger from '../../logger'
import { startAnalyzeDashboard } from '../analyze/dashboard'
import { logBuildAppFinish } from '../logBuildAppFinish'
import { openIde, resolveIdeProjectPath } from '../openIde'
import { filterDuplicateOptions, resolveConfigFile } from '../options'
import { createInlineConfig, logRuntimeTarget, resolveRuntimeTargets } from '../runtime'

export function registerBuildCommand(cli: CAC) {
  cli
    .command('build [root]', 'build for production')
    .option('--target <target>', `[string] transpile target (default: 'modules')`)
    .option('--outDir <dir>', `[string] output directory (default: dist)`)
    .option('-p, --platform <platform>', `[string] target platform (weapp | h5)`)
    .option('--project-config <path>', `[string] project config path (miniprogram only)`)
    .option(
      '--sourcemap [output]',
      `[boolean | "inline" | "hidden"] output source maps for build (default: false)`,
    )
    .option(
      '--minify [minifier]',
      `[boolean | "terser" | "esbuild"] enable/disable minification, `
      + `or specify minifier to use (default: esbuild)`,
    )
    .option(
      '--emptyOutDir',
      `[boolean] force empty outDir when it's outside of root`,
    )
    .option('-w, --watch', `[boolean] rebuilds when modules have changed on disk`)
    .option('--skipNpm', `[boolean] if skip npm build`)
    .option('-o, --open', `[boolean] open ide`)
    .option('--analyze', `[boolean] 输出分包分析仪表盘`, { default: false })
    .action(async (root: string, options: GlobalCLIOptions) => {
      filterDuplicateOptions(options)
      const configFile = resolveConfigFile(options)
      const targets = resolveRuntimeTargets(options)
      logRuntimeTarget(targets)
      const inlineConfig = createInlineConfig(targets.mpPlatform)
      const ctx = await createCompilerContext({
        cwd: root,
        mode: options.mode ?? 'production',
        configFile,
        inlineConfig,
        cliPlatform: targets.rawPlatform,
        projectConfigPath: options.projectConfig,
      })
      const { buildService, configService, webService } = ctx
      const enableAnalyze = Boolean(options.analyze && targets.runMini)
      let analyzeHandle: AnalyzeDashboardHandle | undefined
      if (targets.runMini) {
        await buildService.build(options)
        if (enableAnalyze) {
          const analyzeResult = await analyzeSubpackages(ctx)
          analyzeHandle = await startAnalyzeDashboard(analyzeResult, { watch: true }) ?? undefined
        }
      }
      const webConfig = configService.weappWebConfig
      if (targets.runWeb && webConfig?.enabled) {
        try {
          await webService?.build()
          logger.success(`Web 构建完成，输出目录：${configService.relativeCwd(webConfig.outDir)}`)
        }
        catch (error) {
          logger.error(error)
          throw error
        }
      }
      if (targets.runMini) {
        logBuildAppFinish(configService, undefined, { skipWeb: !targets.runWeb })
      }
      if (options.open && targets.runMini) {
        await openIde(configService.platform, resolveIdeProjectPath(configService.mpDistRoot))
      }

      if (analyzeHandle) {
        await analyzeHandle.waitForExit()
      }
      ctx.watcherService?.closeAll()
      terminateStaleSassEmbeddedProcess()
    })
}

function terminateStaleSassEmbeddedProcess() {
  const getHandles = (process as typeof process & { _getActiveHandles?: () => unknown[] })._getActiveHandles
  const handles = typeof getHandles === 'function' ? getHandles() : undefined
  if (!Array.isArray(handles)) {
    return
  }
  for (const handle of handles) {
    if (isSassEmbeddedChild(handle)) {
      try {
        handle.kill()
      }
      catch { }
    }
  }
}

function isSassEmbeddedChild(handle: unknown): handle is ChildProcess {
  return Boolean(
    handle
    && typeof handle === 'object'
    && 'kill' in handle
    && 'spawnfile' in handle
    && typeof (handle as ChildProcess).spawnfile === 'string'
    && (handle as ChildProcess).spawnfile?.includes('sass-embedded'),
  )
}
