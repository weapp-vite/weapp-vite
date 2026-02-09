import type { CAC } from 'cac'
import type { AnalyzeSubpackagesResult } from '../../analyze/subpackages'
import type { AnalyzeCLIOptions } from '../types'
import process from 'node:process'
import fs from 'fs-extra'
import path from 'pathe'
import { analyzeSubpackages } from '../../analyze/subpackages'
import { createCompilerContext } from '../../createContext'
import logger, { colors } from '../../logger'
import { startAnalyzeDashboard } from '../analyze/dashboard'
import { coerceBooleanOption, filterDuplicateOptions, resolveConfigFile } from '../options'
import { createInlineConfig, logRuntimeTarget, resolveRuntimeTargets } from '../runtime'

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

export function registerAnalyzeCommand(cli: CAC) {
  cli
    .command('analyze [root]', 'analyze 两端包体与源码映射')
    .option('--json', `[boolean] 输出 JSON 结果`)
    .option('--output <file>', `[string] 将分析结果写入指定文件（JSON）`)
    .option('-p, --platform <platform>', `[string] target platform (weapp | h5)`)
    .option('--project-config <path>', `[string] project config path (miniprogram only)`)
    .action(async (root: string, options: AnalyzeCLIOptions) => {
      filterDuplicateOptions(options)
      const configFile = resolveConfigFile(options)
      const outputJson = coerceBooleanOption(options.json)
      const targets = resolveRuntimeTargets(options)
      logRuntimeTarget(targets, { silent: outputJson })
      if (!targets.runMini) {
        logger.warn('当前命令仅支持小程序平台，请通过 --platform weapp 指定目标。')
        return
      }
      if (targets.runWeb) {
        logger.warn('分析命令暂不支持 Web 平台，将忽略相关配置。')
      }
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
        const result = await analyzeSubpackages(ctx)
        const outputOption = typeof options.output === 'string' ? options.output.trim() : ''
        let writtenPath: string | undefined
        if (outputOption) {
          const configService = ctx.configService
          const baseDir = configService?.cwd ?? process.cwd()
          const resolvedOutputPath = path.isAbsolute(outputOption)
            ? outputOption
            : path.resolve(baseDir, outputOption)
          await fs.ensureDir(path.dirname(resolvedOutputPath))
          await fs.writeFile(resolvedOutputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
          const relativeOutput = configService
            ? configService.relativeCwd(resolvedOutputPath)
            : resolvedOutputPath
          logger.success(`分析结果已写入 ${colors.green(relativeOutput)}`)
          writtenPath = resolvedOutputPath
        }
        if (outputJson) {
          if (!writtenPath) {
            process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
          }
        }
        else {
          printAnalysisSummary(result)
          await startAnalyzeDashboard(result)
        }
      }
      catch (error) {
        logger.error(error)
        process.exitCode = 1
      }
    })
}
