import type { CAC } from 'cac'
import type { ChildProcess } from 'node:child_process'
import type { AnalyzeDashboardHandle, DashboardRuntimeEventInput } from '../analyze/dashboard'
import type { GlobalCLIOptions } from '../types'
import process from 'node:process'
import { analyzeSubpackages } from '../../analyze/subpackages'
import { readLatestAnalyzeHistorySnapshot, writeAnalyzeHistorySnapshot } from '../../analyze/subpackages/history'
import { getBackendForCapability } from '../../backends'
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

export function shouldScheduleCompletedProductionBuildExit(options: GlobalCLIOptions, analyzeHandle: AnalyzeDashboardHandle | undefined) {
  return process.env.VITEST !== 'true'
    && process.env.NODE_ENV !== 'test'
    && process.env.WEAPP_VITE_DISABLE_COMPLETED_BUILD_EXIT !== '1'
    && options.watch !== true
    && options.open !== true
    && analyzeHandle === undefined
}

export function scheduleCompletedProductionBuildExit(options: GlobalCLIOptions, analyzeHandle: AnalyzeDashboardHandle | undefined) {
  if (!shouldScheduleCompletedProductionBuildExit(options, analyzeHandle)) {
    return
  }

  const timer = setTimeout(() => {
    if (process.exitCode === undefined || process.exitCode === 0) {
      process.exit(0)
    }
  }, 0)
  timer.unref?.()
}

export function registerBuildCommand(cli: CAC) {
  cli
    .command('build [root]', 'build for production')
    .option('--target <target>', `[string] transpile target (default: 'modules')`)
    .option('--outDir <dir>', `[string] output directory (default: dist)`)
    .option('-p, --platform <platform>', `[string] target platform (weapp | web | all)`)
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
    .option('--no-open-recovery', '[boolean] disable automatic Wechat DevTools close-and-reopen recovery')
    .option('--ui', `[boolean] 启动调试 UI（当前提供分析视图）`, { default: false })
    .option('--analyze', `[boolean] 输出分包分析仪表盘`, { default: false })
    .option('--scope <scope>', `[string] 局部构建范围，例如 main,packages/order`)
    .action(async (root: string, options: GlobalCLIOptions) => {
      let analyzeHandle: AnalyzeDashboardHandle | undefined
      let ctx: Awaited<ReturnType<typeof createCompilerContext>> | undefined
      let targets: ReturnType<typeof resolveRuntimeTargets> | undefined
      let buildCompleted = false
      try {
        filterDuplicateOptions(options)
        const cwd = root ?? process.cwd()
        const configFile = resolveConfigFile(options)
        targets = resolveRuntimeTargets(options)
        const inlineConfig = createInlineConfig(targets, { scope: options.scope })
        ctx = await createCompilerContext({
          cwd,
          mode: options.mode ?? 'production',
          configFile,
          inlineConfig,
          cliPlatform: targets.rawPlatform,
          projectConfigPath: options.projectConfig,
          emitDefaultAutoImportOutputs: false,
          preloadAppEntry: false,
        })
        const { configService } = ctx
        const miniBackend = getBackendForCapability(targets, 'miniprogram', 'build')
        const webBackend = getBackendForCapability(targets, 'web', 'build')
        logRuntimeTarget(targets, { resolvedConfigPlatform: configService.platform })
        const enableAnalyze = Boolean(isUiEnabled(options) && miniBackend)
        for (const backend of targets.select('build')) {
          if (backend.descriptor.id === 'miniprogram') {
            const miniBuildStartedAt = Date.now()
            const output = await backend.driver.build(ctx, options) as Awaited<ReturnType<typeof ctx.buildService.build>>
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
              const previousAnalyzeResult = await readLatestAnalyzeHistorySnapshot(configService)
              const analyzeResult = await analyzeSubpackages(ctx)
              await writeAnalyzeHistorySnapshot(analyzeResult, configService)
              const analyzeDurationMs = Date.now() - analyzeStartedAt
              analyzeHandle = await startAnalyzeDashboard(analyzeResult, {
                watch: true,
                artifactRoot: configService.outDir,
                cwd: configService.cwd,
                packageManagerAgent: configService.packageManager.agent,
                previousResult: previousAnalyzeResult,
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
            continue
          }

          const webConfig = configService.weappWebConfig
          if (backend.descriptor.id !== 'web' || !webConfig?.enabled) {
            continue
          }
          const webBuildStartedAt = Date.now()
          try {
            await backend.driver.build(ctx, options)
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
        if (miniBackend) {
          logBuildAppFinish(configService, undefined, { skipWeb: !webBackend })
        }
        if (options.open && getBackendForCapability(targets, 'miniprogram', 'ide')) {
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
            openRecovery: options.openRecovery,
            trustProject: options.trustProject,
          })
        }

        if (analyzeHandle) {
          await analyzeHandle.waitForExit()
        }
        buildCompleted = true
      }
      finally {
        if (ctx && targets) {
          for (const backend of [...targets.select('build')].reverse()) {
            await backend.driver.close(ctx)
          }
        }
        terminateStaleSassEmbeddedProcess()
        if (buildCompleted) {
          scheduleCompletedProductionBuildExit(options, analyzeHandle)
        }
      }
    })
}
