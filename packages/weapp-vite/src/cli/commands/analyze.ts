import type { CAC } from 'cac'
import type { HmrProfileAnalyzeResult } from '../../analyze/hmr'
import type { AnalyzeSubpackagesResult } from '../../analyze/subpackages'
import type { ConfigService } from '../../runtime/config/types'
import type { AnalyzeCLIOptions } from '../types'
import process from 'node:process'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { analyzeHmrProfile } from '../../analyze/hmr'
import { analyzeSubpackages } from '../../analyze/subpackages'
import { createCompilerContext } from '../../createContext'
import logger, { colors } from '../../logger'
import { resolveHmrProfileJsonPath } from '../../utils/hmrProfile'
import { startAnalyzeDashboard } from '../analyze/dashboard'
import { coerceBooleanOption, filterDuplicateOptions, resolveConfigFile } from '../options'
import { createInlineConfig, logRuntimeTarget, resolveRuntimeTargets } from '../runtime'

export interface WebAnalyzeResult {
  runtime: 'web'
  platform: 'h5' | 'web'
  mode: string
  generatedAt: string
  experimental: true
  configFile?: string
  web: {
    enabled: boolean
    root?: string
    srcDir?: string
    outDir?: string
    executionMode: 'compat' | 'safe' | 'strict'
  }
  supportedScopes: string[]
  unsupportedScopes: string[]
  limitations: string[]
}

interface CreateWebAnalyzeResultOptions {
  platform: 'h5' | 'web'
  now?: Date
}

function normalizeDisplayPath(value: string) {
  return value || '.'
}

function getDefaultWebAnalyzeScopes() {
  return {
    supported: [
      'weapp.web 配置解析（enable/root/srcDir/outDir）',
      'runtime.executionMode 静态解析（compat/safe/strict）',
      'JSON 报告输出（--json/--output）',
    ],
    unsupported: [
      '分包产物体积分析（仅小程序）',
      '源码模块包体映射（仅小程序）',
      '分析仪表盘（dashboard）',
    ],
  }
}

export function createWebAnalyzeResult(
  configService: ConfigService,
  options: CreateWebAnalyzeResultOptions,
): WebAnalyzeResult {
  const webConfig = configService.weappWebConfig
  const executionMode = webConfig?.pluginOptions.runtime?.executionMode ?? 'compat'
  const scope = getDefaultWebAnalyzeScopes()
  const limitations = [
    '当前仅提供静态配置分析，不执行 Web 产物扫描。',
  ]

  if (!webConfig?.enabled) {
    limitations.push('未检测到启用的 weapp.web 配置。')
  }

  return {
    runtime: 'web',
    platform: options.platform,
    mode: configService.mode,
    generatedAt: (options.now ?? new Date()).toISOString(),
    experimental: true,
    configFile: configService.configFilePath
      ? normalizeDisplayPath(configService.relativeCwd(configService.configFilePath))
      : undefined,
    web: {
      enabled: Boolean(webConfig?.enabled),
      root: webConfig?.root ? normalizeDisplayPath(configService.relativeCwd(webConfig.root)) : undefined,
      srcDir: webConfig?.srcDir,
      outDir: webConfig?.outDir ? normalizeDisplayPath(configService.relativeCwd(webConfig.outDir)) : undefined,
      executionMode,
    },
    supportedScopes: scope.supported,
    unsupportedScopes: scope.unsupported,
    limitations,
  }
}

function printAnalysisSummary(result: AnalyzeSubpackagesResult) {
  const packageLabelMap = new Map<string, string>()
  const packageModuleSet = new Map<string, Set<string>>()

  for (const pkg of result.packages) {
    packageLabelMap.set(pkg.id, pkg.label)
  }

  for (const module of result.modules) {
    for (const pkgRef of module.packages) {
      const set = packageModuleSet.get(pkgRef.packageId) ?? new Set<string>()
      set.add(module.id)
      packageModuleSet.set(pkgRef.packageId, set)
    }
  }

  logger.success('分包分析完成')

  for (const pkg of result.packages) {
    const chunkCount = pkg.files.filter(file => file.type === 'chunk').length
    const assetCount = pkg.files.length - chunkCount
    const moduleCount = packageModuleSet.get(pkg.id)?.size ?? 0
    logger.info(`- ${pkg.label}：${chunkCount} 个模块产物，${assetCount} 个资源，覆盖 ${moduleCount} 个源码模块`)
  }

  if (result.subPackages.length > 0) {
    logger.info('分包配置：')
    for (const descriptor of result.subPackages) {
      const segments = [descriptor.root]
      if (descriptor.name) {
        segments.push(`别名：${descriptor.name}`)
      }
      if (descriptor.independent) {
        segments.push('独立构建')
      }
      logger.info(`- ${segments.join('，')}`)
    }
  }

  const duplicates = result.modules.filter(module => module.packages.length > 1)
  if (duplicates.length === 0) {
    logger.info('未检测到跨包复用的源码模块。')
    return
  }

  logger.info(`跨包复用/复制源码共 ${duplicates.length} 项：`)
  const limit = 10
  const entries = duplicates.slice(0, limit)
  for (const module of entries) {
    const placements = module.packages
      .map((pkgRef) => {
        const label = packageLabelMap.get(pkgRef.packageId) ?? pkgRef.packageId
        return `${label} → ${pkgRef.files.join(', ')}`
      })
      .join('；')
    logger.info(`- ${module.source} (${module.sourceType})：${placements}`)
  }
  if (duplicates.length > limit) {
    logger.info(`- …其余 ${duplicates.length - limit} 项请使用 ${colors.bold(colors.green('weapp-vite analyze --json'))} 查看`)
  }
}

function printWebAnalysisSummary(result: WebAnalyzeResult) {
  logger.success('Web 静态分析完成')
  logger.info(`- 配置状态：${result.web.enabled ? '已启用 weapp.web' : '未启用 weapp.web'}`)
  if (result.web.enabled) {
    logger.info(`- root：${result.web.root ?? '.'}`)
    logger.info(`- srcDir：${result.web.srcDir ?? '.'}`)
    logger.info(`- outDir：${result.web.outDir ?? 'dist/web'}`)
  }
  logger.info(`- executionMode：${result.web.executionMode}`)
  logger.info(`- 支持范围：${result.supportedScopes.join('；')}`)
  logger.warn(`- 未支持范围：${result.unsupportedScopes.join('；')}`)
  for (const limitation of result.limitations) {
    logger.warn(`- 限制：${limitation}`)
  }
}

async function writeAnalyzeResult(
  result: AnalyzeSubpackagesResult | WebAnalyzeResult | HmrProfileAnalyzeResult,
  outputOption: string,
  configService: ConfigService,
) {
  if (!outputOption) {
    return undefined
  }
  const baseDir = configService.cwd
  const resolvedOutputPath = path.isAbsolute(outputOption)
    ? outputOption
    : path.resolve(baseDir, outputOption)
  await fs.ensureDir(path.dirname(resolvedOutputPath))
  await fs.writeFile(resolvedOutputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  const relativeOutput = configService.relativeCwd(resolvedOutputPath)
  logger.success(`分析结果已写入 ${colors.green(relativeOutput)}`)
  return resolvedOutputPath
}

function formatMetricSummary(label: string, metric: HmrProfileAnalyzeResult['metrics'][keyof HmrProfileAnalyzeResult['metrics']]) {
  if (!metric.count || metric.averageMs === undefined || metric.maxMs === undefined) {
    return undefined
  }
  return `${label} avg ${metric.averageMs.toFixed(2)} ms，max ${metric.maxMs.toFixed(2)} ms`
}

function formatCountItems(items: HmrProfileAnalyzeResult['events'], limit: number = 5) {
  const entries = items.slice(0, limit).map(item => `${item.name} x${item.count}`)
  return entries.join('，')
}

function printHmrProfileAnalysisSummary(result: HmrProfileAnalyzeResult, configService: ConfigService) {
  logger.success('HMR profile 分析完成')
  logger.info(`- profile：${colors.green(configService.relativeCwd(result.profilePath))}`)
  logger.info(`- 样本：${result.sampleCount} 条`)
  if (result.firstTimestamp && result.lastTimestamp) {
    logger.info(`- 时间范围：${result.firstTimestamp} -> ${result.lastTimestamp}`)
  }

  const totalSummary = formatMetricSummary('total', result.metrics.totalMs)
  const watchSummary = formatMetricSummary('watch->dirty', result.metrics.watchToDirtyMs)
  const emitSummary = formatMetricSummary('emit', result.metrics.emitMs)
  const sharedSummary = formatMetricSummary('shared', result.metrics.sharedChunkResolveMs)

  for (const summary of [totalSummary, watchSummary, emitSummary, sharedSummary]) {
    if (summary) {
      logger.info(`- ${summary}`)
    }
  }

  if (result.events.length) {
    logger.info(`- 事件分布：${formatCountItems(result.events)}`)
  }
  if (result.dirtyReasons.length) {
    logger.info(`- 主要 dirty 原因：${formatCountItems(result.dirtyReasons)}`)
  }
  if (result.pendingReasons.length) {
    logger.info(`- 主要 pending 原因：${formatCountItems(result.pendingReasons)}`)
  }
  if (result.skippedLineCount > 0) {
    logger.warn(`- 跳过 ${result.skippedLineCount} 条无法解析的 profile 记录`)
  }
  if (result.slowestSamples.length) {
    logger.info('- 最慢样本：')
    for (const sample of result.slowestSamples.slice(0, 3)) {
      const fileLabel = sample.file ? configService.relativeCwd(sample.file) : '(unknown)'
      logger.info(`  - ${sample.totalMs?.toFixed(2) ?? '0.00'} ms，${sample.event ?? 'unknown'}，${fileLabel}`)
    }
  }
}

export function registerAnalyzeCommand(cli: CAC) {
  cli
    .command('analyze [root]', 'analyze 两端包体与源码映射')
    .option('--hmr-profile [file]', `[string | boolean] 分析 HMR JSONL profile，省略值时优先读取配置，否则回退到默认路径`)
    .option('--json', `[boolean] 输出 JSON 结果`)
    .option('--output <file>', `[string] 将分析结果写入指定文件（JSON）`)
    .option('-p, --platform <platform>', `[string] target platform (weapp | h5)`)
    .option('--project-config <path>', `[string] project config path (miniprogram only)`)
    .action(async (root: string, options: AnalyzeCLIOptions) => {
      filterDuplicateOptions(options)
      const configFile = resolveConfigFile(options)
      const outputJson = coerceBooleanOption(options.json)
      const targets = resolveRuntimeTargets(options)
      const inlineConfig = createInlineConfig(targets.mpPlatform)
      try {
        const ctx = await createCompilerContext({
          cwd: root,
          mode: options.mode ?? 'production',
          configFile,
          inlineConfig,
          cliPlatform: targets.rawPlatform,
          projectConfigPath: options.projectConfig,
        })
        logRuntimeTarget(targets, {
          silent: outputJson,
          resolvedConfigPlatform: ctx.configService.platform,
        })
        const outputOption = typeof options.output === 'string' ? options.output.trim() : ''
        if (options.hmrProfile !== undefined && options.hmrProfile !== false) {
          const profileOption = typeof options.hmrProfile === 'string' && options.hmrProfile.trim()
            ? options.hmrProfile.trim()
            : ctx.configService.weappViteConfig.hmr?.profileJson
          const profilePath = resolveHmrProfileJsonPath({
            cwd: ctx.configService.cwd,
            option: profileOption,
            fallbackToDefault: true,
          })
          if (!profilePath) {
            throw new Error('未找到可用的 HMR profile 文件路径')
          }
          const hmrProfileResult = await analyzeHmrProfile({
            profilePath,
          })
          const writtenPath = await writeAnalyzeResult(hmrProfileResult, outputOption, ctx.configService)
          if (outputJson) {
            if (!writtenPath) {
              process.stdout.write(`${JSON.stringify(hmrProfileResult, null, 2)}\n`)
            }
          }
          else {
            printHmrProfileAnalysisSummary(hmrProfileResult, ctx.configService)
          }
          return
        }
        if (targets.runWeb) {
          const webResult = createWebAnalyzeResult(ctx.configService, {
            platform: targets.label === 'web' ? 'web' : 'h5',
          })
          const writtenPath = await writeAnalyzeResult(webResult, outputOption, ctx.configService)
          if (outputJson) {
            if (!writtenPath) {
              process.stdout.write(`${JSON.stringify(webResult, null, 2)}\n`)
            }
          }
          else {
            printWebAnalysisSummary(webResult)
          }
          return
        }

        if (!targets.runMini) {
          logger.warn('当前命令不支持该平台，请通过 --platform weapp 或 --platform h5 指定目标。')
          return
        }

        const result = await analyzeSubpackages(ctx)
        const writtenPath = await writeAnalyzeResult(result, outputOption, ctx.configService)
        if (outputJson) {
          if (!writtenPath) {
            process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
          }
        }
        else {
          printAnalysisSummary(result)
          await startAnalyzeDashboard(result, {
            cwd: ctx.configService.cwd,
            packageManagerAgent: ctx.configService.packageManager.agent,
          })
        }
      }
      catch (error) {
        logger.error(error)
        process.exitCode = 1
      }
    })
}
