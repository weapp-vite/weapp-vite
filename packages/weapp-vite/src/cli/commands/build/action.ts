import type { CAC } from 'cac'
import type { InlineConfig } from 'vite'
import type { DashboardRuntimeEventInput } from '../../../dashboard'
import type { AnalyzeDashboardHandle } from '../../analyze/dashboard'
import type { GlobalCLIOptions } from '../../types'
import type { BuildUploadCLIOptions } from '../../upload/options'
import process from 'node:process'
import { analyzeSubpackages } from '../../../analyze/subpackages'
import { readLatestAnalyzeHistorySnapshot, writeAnalyzeHistorySnapshot } from '../../../analyze/subpackages/history'
import { getBackendForCapability } from '../../../backends'
import { createDashboardArtifactSnapshot } from '../../../dashboard/artifacts'
import logger, { colors } from '../../../logger'
import { CompilerSession } from '../../../runtime/compilerSession'
import { startAnalyzeDashboard } from '../../analyze/dashboard'
import { formatDuration } from '../../formatDuration'
import { logBuildAppFinish } from '../../logBuildAppFinish'
import { logBuildPackageSizeReport } from '../../logBuildPackageSizeReport'
import { setCommandNodeEnv } from '../../nodeEnv'
import { openIde, resolveIdeProjectPath } from '../../openIde'
import { filterDuplicateOptions, isUiEnabled, parseDashboardUiHost, resolveConfigFile } from '../../options'
import { createInlineConfig, logRuntimeTarget, resolveConfiguredRuntimeTargets, resolveRuntimeTargets } from '../../runtime'
import { prepareAutoUploadMetadataWithRollback, validateAutoUploadMetadata } from '../../upload/autoMetadata'
import { createUploadTarget, executeUploadTarget } from '../../upload/builtProject'
import { resolveBuildUploadOptions } from '../../upload/options'

import { scheduleCompletedProductionBuildExit } from './completion'

function emitDashboardEvents(handle: AnalyzeDashboardHandle | undefined, events: DashboardRuntimeEventInput[]) {
  handle?.emitRuntimeEvents(events)
}

function normalizeBuildSourcemap(
  value: GlobalCLIOptions['sourcemap'],
): NonNullable<InlineConfig['build']>['sourcemap'] {
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  return value
}

function normalizeBuildMinify(
  value: GlobalCLIOptions['minify'],
): NonNullable<InlineConfig['build']>['minify'] {
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  return value
}

function hasCliOption(options: GlobalCLIOptions, key: keyof GlobalCLIOptions) {
  return Object.prototype.hasOwnProperty.call(options, key)
}

function createBuildInlineConfig(options: GlobalCLIOptions): InlineConfig | undefined {
  const build: NonNullable<InlineConfig['build']> = {}
  if (typeof options.outDir === 'string') {
    build.outDir = options.outDir
  }
  if (hasCliOption(options, 'sourcemap')) {
    build.sourcemap = normalizeBuildSourcemap(options.sourcemap)
  }
  if (hasCliOption(options, 'minify')) {
    build.minify = normalizeBuildMinify(options.minify)
  }
  if (typeof options.emptyOutDir === 'boolean') {
    build.emptyOutDir = options.emptyOutDir
  }

  return Object.keys(build).length
    ? { build }
    : undefined
}

/** 执行已完成参数校验的生产构建，复用注册器持有的原始命令参数。 */
export async function runBuildCommand(cli: CAC, root: string, options: BuildUploadCLIOptions) {
  let analyzeHandle: AnalyzeDashboardHandle | undefined
  let session: CompilerSession | undefined
  let ctx: CompilerSession['context'] | undefined
  let targets: ReturnType<typeof resolveRuntimeTargets> | undefined
  let uploadMetadataRollback: (() => Promise<void>) | undefined
  let buildCompleted = false
  let buildFailed = false
  try {
    options = { ...options }
    filterDuplicateOptions(options)
    options.uiHost = parseDashboardUiHost(options.uiHost)
    let uploadOptions = resolveBuildUploadOptions(cli, options)
    setCommandNodeEnv('production')
    const cwd = root ?? process.cwd()
    const configFile = resolveConfigFile(options)
    targets = resolveRuntimeTargets(options)
    if (uploadOptions) {
      validateAutoUploadMetadata(uploadOptions, 'upload')
    }
    if (uploadOptions && !getBackendForCapability(targets, 'miniprogram', 'build')) {
      throw new Error('--upload 仅支持包含小程序目标的构建，不能用于纯 Web 构建。')
    }
    const inlineConfig = createInlineConfig(targets, {
      scope: options.scope,
      inlineConfig: createBuildInlineConfig(options),
    })
    if (uploadOptions) {
      const prepared = await prepareAutoUploadMetadataWithRollback(cwd, uploadOptions, 'upload')
      uploadOptions = prepared.options
      uploadMetadataRollback = prepared.rollback
    }
    session = new CompilerSession()
    ctx = await session.initialize({
      cwd,
      mode: options.mode ?? 'production',
      configFile,
      inlineConfig,
      cliPlatform: targets.rawPlatform,
      projectConfigPath: options.projectConfig,
      emitDefaultAutoImportOutputs: false,
      preloadAppEntry: false,
    })
    targets = resolveConfiguredRuntimeTargets(targets, ctx.configService.options?.sourceConfig?.weapp?.platform)
    if (uploadOptions && !getBackendForCapability(targets, 'miniprogram', 'build')) {
      await uploadMetadataRollback?.()
      uploadMetadataRollback = undefined
      throw new Error('--upload 仅支持包含小程序目标的构建，不能用于纯 Web 构建。')
    }
    uploadMetadataRollback = undefined
    for (const backend of targets.select('build')) {
      session.onClose(() => backend.driver.close(ctx!))
    }
    const { configService } = ctx
    const uploadTarget = uploadOptions ? await createUploadTarget(configService, uploadOptions, 'upload') : undefined
    const miniBackend = getBackendForCapability(targets, 'miniprogram', 'build')
    const webBackend = getBackendForCapability(targets, 'web', 'build')
    logRuntimeTarget(targets, { resolvedConfigPlatform: configService.platform })
    const enableAnalyze = Boolean(isUiEnabled(options) && miniBackend)
    for (const backend of targets.select('build')) {
      if (backend.descriptor.id === 'miniprogram') {
        const miniBuildStartedAt = Date.now()
        const output = await session.run(() => backend.driver.build(ctx!, options)) as Awaited<ReturnType<typeof ctx.buildService.build>>
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
          const artifactSnapshot = createDashboardArtifactSnapshot()
          const analyzeResult = await analyzeSubpackages(ctx, { onArtifact: artifactSnapshot.capture })
          await writeAnalyzeHistorySnapshot(analyzeResult, configService)
          const analyzeDurationMs = Date.now() - analyzeStartedAt
          analyzeHandle = await startAnalyzeDashboard(analyzeResult, {
            watch: true,
            uiHost: options.uiHost,
            artifacts: artifactSnapshot.files,
            cwd: configService.cwd,
            packageManagerAgent: configService.packageManager.agent,
            pluginRoot: configService.absolutePluginRoot,
            srcRoot: configService.absoluteSrcRoot,
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
        await session.run(() => backend.driver.build(ctx!, options))
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
    if (uploadTarget && uploadOptions) {
      await executeUploadTarget(uploadTarget, uploadOptions, 'upload')
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
      const generatedProjectConfig = configService.multiPlatform.projectConfigs !== undefined
      await openIde(configService.platform, resolveIdeProjectPath(
        generatedProjectConfig ? configService.outDir : configService.mpDistRoot,
        generatedProjectConfig,
      ), {
        openRecovery: options.openRecovery,
        trustProject: options.trustProject,
        openStrategy: options.ideOpenStrategy,
      })
    }

    if (analyzeHandle) {
      await analyzeHandle.waitForExit()
    }
    buildCompleted = true
  }
  catch (error) {
    buildFailed = true
    throw error
  }
  finally {
    if (buildFailed) {
      await session?.close().catch(error => logger.error(error))
    }
    else {
      await session?.close()
    }
    if (buildCompleted) {
      scheduleCompletedProductionBuildExit(options, analyzeHandle)
    }
  }
}
