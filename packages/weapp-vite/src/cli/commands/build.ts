import type { CAC } from 'cac'
import type { ChildProcess } from 'node:child_process'
import type { AnalyzeDashboardHandle, DashboardRuntimeEventInput } from '../analyze/dashboard'
import type { GlobalCLIOptions } from '../types'
import process from 'node:process'
import { analyzeSubpackages } from '../../analyze/subpackages'
import { createCompilerContext } from '../../createContext'
import logger, { colors } from '../../logger'
import { startAnalyzeDashboard } from '../analyze/dashboard'
import { formatDuration } from '../formatDuration'
import { logBuildAppFinish } from '../logBuildAppFinish'
import { logBuildPackageSizeReport } from '../logBuildPackageSizeReport'
import { openIde, resolveIdeProjectPath } from '../openIde'
import { filterDuplicateOptions, isUiEnabled, resolveConfigFile } from '../options'
import { createInlineConfig, logRuntimeTarget, resolveRuntimeTargets } from '../runtime'

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

function emitDashboardEvents(handle: AnalyzeDashboardHandle | undefined, events: DashboardRuntimeEventInput[]) {
  handle?.emitRuntimeEvents(events)
}

export function registerBuildCommand(cli: CAC) {
  cli
    .command('build [root]', 'build for production')
    .option('--target <target>', `[string] transpile target (default: 'modules')`)
    .option('--outDir <dir>', `[string] output directory (default: dist)`)
    .option('-p, --platform <platform>', `[string] target platform (weapp | h5 | all)`)
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
    .option('--trust-project', '[boolean] auto trust Wechat DevTools project on open', { default: true })
    .option('--ui', `[boolean] 启动调试 UI（当前提供分析视图）`, { default: false })
    .option('--analyze', `[boolean] 输出分包分析仪表盘`, { default: false })
    .action(async (root: string, options: GlobalCLIOptions) => {
      filterDuplicateOptions(options)
      const configFile = resolveConfigFile(options)
      const targets = resolveRuntimeTargets(options)
      const inlineConfig = createInlineConfig(targets.mpPlatform)
      const ctx = await createCompilerContext({
        cwd: root,
        mode: options.mode ?? 'production',
        configFile,
        inlineConfig,
        cliPlatform: targets.rawPlatform,
        projectConfigPath: options.projectConfig,
        emitDefaultAutoImportOutputs: false,
        syncSupportFiles: false,
        preloadAppEntry: false,
      })
      const { buildService, configService, webService } = ctx
      logRuntimeTarget(targets, { resolvedConfigPlatform: configService.platform })
      const enableAnalyze = Boolean(isUiEnabled(options) && targets.runMini)
      let analyzeHandle: AnalyzeDashboardHandle | undefined
      if (targets.runMini) {
        const miniBuildStartedAt = Date.now()
        const output = await buildService.build(options)
        const miniBuildDurationMs = Date.now() - miniBuildStartedAt
        logger.success(`小程序构建完成，耗时：${colors.green(formatDuration(miniBuildDurationMs))}`)
        if (!Array.isArray(output) && 'output' in output) {
          logBuildPackageSizeReport({
            output,
            subPackageMap: ctx.scanService?.subPackageMap,
            warningBytes: configService.weappViteConfig.packageSizeWarningBytes,
          })
        }
        if (enableAnalyze) {
          const analyzeStartedAt = Date.now()
          const analyzeResult = await analyzeSubpackages(ctx)
          const analyzeDurationMs = Date.now() - analyzeStartedAt
          analyzeHandle = await startAnalyzeDashboard(analyzeResult, {
            watch: true,
            cwd: configService.cwd,
            packageManagerAgent: configService.packageManager.agent,
            initialEvents: [
              {
                kind: 'build',
                level: 'success',
                title: 'mini build completed',
                detail: `生产构建已完成，当前 analyze 结果包含 ${analyzeResult.packages.length} 个包。`,
                durationMs: miniBuildDurationMs,
                tags: ['build', 'mini'],
              },
              {
                kind: 'build',
                level: 'success',
                title: 'analyze completed',
                detail: `分析已完成，当前包含 ${analyzeResult.packages.length} 个包与 ${analyzeResult.modules.length} 个模块。`,
                durationMs: analyzeDurationMs,
                tags: ['build', 'analyze'],
              },
            ],
          }) ?? undefined
        }
      }
      const webConfig = configService.weappWebConfig
      if (targets.runWeb && webConfig?.enabled) {
        const webBuildStartedAt = Date.now()
        try {
          await webService?.build()
          const webBuildDurationMs = Date.now() - webBuildStartedAt
          logger.success(`Web 构建完成，输出目录：${colors.green(configService.relativeCwd(webConfig.outDir))}，耗时：${colors.green(formatDuration(webBuildDurationMs))}`)
          emitDashboardEvents(analyzeHandle, [
            {
              kind: 'build',
              level: 'success',
              title: 'web build completed',
              detail: `Web 构建已完成，输出目录 ${configService.relativeCwd(webConfig.outDir)}。`,
              durationMs: webBuildDurationMs,
              tags: ['build', 'web'],
            },
          ])
        }
        catch (error) {
          emitDashboardEvents(analyzeHandle, [
            {
              kind: 'diagnostic',
              level: 'error',
              title: 'web build failed',
              detail: error instanceof Error ? error.message : String(error),
              durationMs: Date.now() - webBuildStartedAt,
              tags: ['build', 'web'],
            },
          ])
          logger.error(error)
          throw error
        }
      }
      if (targets.runMini) {
        logBuildAppFinish(configService, undefined, { skipWeb: !targets.runWeb })
      }
      if (options.open && targets.runMini) {
        emitDashboardEvents(analyzeHandle, [
          {
            kind: 'command',
            level: 'info',
            title: 'opening ide',
            detail: '构建完成后准备打开 IDE 项目。',
            tags: ['ide', 'open'],
          },
        ])
        await openIde(configService.platform, resolveIdeProjectPath(configService.mpDistRoot), {
          trustProject: options.trustProject,
        })
      }

      if (analyzeHandle) {
        await analyzeHandle.waitForExit()
      }
      ctx.watcherService?.closeAll()
      terminateStaleSassEmbeddedProcess()
    })
}
