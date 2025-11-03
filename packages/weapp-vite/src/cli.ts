import type { TemplateName } from '@weapp-core/init'
import type { GenerateType } from '@weapp-core/schematics'
import type { InlineConfig, ViteDevServer } from 'vite'
import type { AnalyzeSubpackagesResult } from './analyze/subpackages'
import type { ConfigService } from './context'
import type { LogLevel } from './logger'
import type { MpPlatform } from './types'
import process from 'node:process'
import { createProject, initConfig } from '@weapp-core/init'
import { defu } from '@weapp-core/shared'
import { cac } from 'cac'
import fs from 'fs-extra'
import { resolveCommand } from 'package-manager-detector/commands'
import path from 'pathe'
import { loadConfigFromFile } from 'vite'
import { parse } from 'weapp-ide-cli'
import { analyzeSubpackages } from './analyze/subpackages'
import { VERSION } from './constants'
import { createCompilerContext } from './createContext'
import logger from './logger'
import { DEFAULT_MP_PLATFORM, normalizeMiniPlatform, resolveMiniPlatform } from './platform'
import { generate } from './schematics'
import { checkRuntime, resolveWeappConfigFile } from './utils'

const cli = cac('weapp-vite')

try {
  checkRuntime({
    bun: '0.0.0',
    deno: '0.0.0',
    node: '20.19.0',
  })
}
catch {

}

async function loadConfig(configFile?: string) {
  const cwd = process.cwd()
  let resolvedConfigFile = configFile
  if (resolvedConfigFile && !path.isAbsolute(resolvedConfigFile)) {
    resolvedConfigFile = path.resolve(cwd, resolvedConfigFile)
  }

  const configEnv = {
    command: 'serve' as const,
    mode: 'development',
  }

  const loaded = await loadConfigFromFile(configEnv, resolvedConfigFile, cwd)
  const weappConfigFilePath = await resolveWeappConfigFile({
    root: cwd,
    specified: resolvedConfigFile,
  })

  let weappLoaded: Awaited<ReturnType<typeof loadConfigFromFile>> | undefined
  if (weappConfigFilePath) {
    const normalizedWeappPath = path.resolve(weappConfigFilePath)
    const normalizedLoadedPath = loaded?.path ? path.resolve(loaded.path) : undefined
    if (normalizedLoadedPath && normalizedLoadedPath === normalizedWeappPath) {
      weappLoaded = loaded
    }
    else {
      weappLoaded = await loadConfigFromFile(configEnv, weappConfigFilePath, cwd)
    }
  }

  if (!loaded && !weappLoaded) {
    return undefined
  }

  const config = loaded?.config ?? (weappLoaded?.config ?? {})
  if (weappLoaded?.config?.weapp) {
    config.weapp = defu(
      weappLoaded.config.weapp,
      config.weapp ?? {},
    )
  }

  const dependencySet = new Set<string>()
  for (const dependency of loaded?.dependencies ?? []) {
    dependencySet.add(dependency)
  }
  for (const dependency of weappLoaded?.dependencies ?? []) {
    dependencySet.add(dependency)
  }

  return {
    config,
    path: weappLoaded?.path ?? loaded?.path ?? resolvedConfigFile,
    dependencies: Array.from(dependencySet),
  }
}

let logBuildAppFinishOnlyShowOnce = false

function logBuildAppFinish(
  configService: ConfigService,
  webServer?: ViteDevServer | undefined,
  options: { skipMini?: boolean, skipWeb?: boolean } = {},
) {
  if (logBuildAppFinishOnlyShowOnce) {
    return
  }
  const { skipMini = false, skipWeb = false } = options
  if (skipMini) {
    if (webServer) {
      const urls = webServer.resolvedUrls
      const candidates = urls
        ? [...(urls.local ?? []), ...(urls.network ?? [])]
        : []
      if (candidates.length > 0) {
        logger.success('Web 运行时已启动，浏览器访问：')
        for (const url of candidates) {
          logger.info(`  ➜  ${url}`)
        }
      }
      else {
        logger.success('Web 运行时已启动')
      }
    }
    else {
      logger.success('Web 运行时已启动')
    }
    logBuildAppFinishOnlyShowOnce = true
    return
  }

  const { command, args } = resolveCommand(
    configService.packageManager.agent,
    'run',
    ['open'],
  ) ?? {
    command: 'npm',
    args: ['run', 'open'],
  }
  const devCommand = `${command} ${args.join(' ')}`
  logger.success('应用构建完成！预览方式 ( `2` 种选其一即可)：')
  logger.info(`执行 \`${devCommand}\` 可以直接在 \`微信开发者工具\` 里打开当前应用`)
  logger.info('或手动打开微信开发者工具，导入根目录(`project.config.json` 文件所在的目录)，即可预览效果')
  if (!skipWeb && webServer) {
    const urls = webServer.resolvedUrls
    const candidates = urls
      ? [...(urls.local ?? []), ...(urls.network ?? [])]
      : []
    if (candidates.length > 0) {
      logger.success('Web 运行时已启动，浏览器访问：')
      for (const url of candidates) {
        logger.info(`  ➜  ${url}`)
      }
    }
    else {
      logger.success('Web 运行时已启动')
    }
  }
  logBuildAppFinishOnlyShowOnce = true
}
interface GlobalCLIOptions {
  '--'?: string[]
  'c'?: boolean | string
  'config'?: string
  'base'?: string
  'l'?: LogLevel
  'logLevel'?: LogLevel
  'clearScreen'?: boolean
  'd'?: boolean | string
  'debug'?: boolean | string
  'f'?: string
  'filter'?: string
  'm'?: string
  'mode'?: string
  'force'?: boolean
  'skipNpm'?: boolean
  'open'?: boolean
  'json'?: boolean | string
  'output'?: string
  'p'?: string
  'platform'?: string
}

interface AnalyzeCLIOptions extends GlobalCLIOptions {
  json?: boolean | string
  output?: string
}

function filterDuplicateOptions<T extends object>(options: T) {
  for (const [key, value] of Object.entries(options)) {
    if (Array.isArray(value)) {
      options[key as keyof T] = value[value.length - 1]
    }
  }
}

function resolveConfigFile(options: Pick<GlobalCLIOptions, 'config' | 'c'>) {
  if (typeof options.config === 'string') {
    return options.config
  }
  if (typeof options.c === 'string') {
    return options.c
  }
}

function convertBase(v: any) {
  if (v === 0) {
    return ''
  }
  return v
}

function coerceBooleanOption(value: unknown) {
  if (value === undefined) {
    return undefined
  }
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === '') {
      return true
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'off' || normalized === 'no') {
      return false
    }
    if (normalized === 'true' || normalized === '1' || normalized === 'on' || normalized === 'yes') {
      return true
    }
    return true
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  return Boolean(value)
}

async function openIde() {
  try {
    await parse(['open', '-p'])
  }
  catch (error) {
    logger.error(error)
  }
}

interface RuntimeTargets {
  runMini: boolean
  runWeb: boolean
  mpPlatform?: MpPlatform
  label: string
}

function logRuntimeTarget(targets: RuntimeTargets) {
  logger.info(`目标平台：${targets.label}`)
}

function resolveRuntimeTargets(options: GlobalCLIOptions): RuntimeTargets {
  const rawPlatform = typeof options.platform === 'string'
    ? options.platform
    : typeof options.p === 'string'
      ? options.p
      : undefined
  if (!rawPlatform) {
    return {
      runMini: true,
      runWeb: false,
      mpPlatform: DEFAULT_MP_PLATFORM,
      label: DEFAULT_MP_PLATFORM,
    }
  }
  const normalized = normalizeMiniPlatform(rawPlatform)
  if (!normalized) {
    return {
      runMini: true,
      runWeb: false,
      mpPlatform: DEFAULT_MP_PLATFORM,
      label: DEFAULT_MP_PLATFORM,
    }
  }
  if (normalized === 'h5' || normalized === 'web') {
    return {
      runMini: false,
      runWeb: true,
      mpPlatform: undefined,
      label: normalized === 'h5' ? 'h5' : 'web',
    }
  }
  const mpPlatform = resolveMiniPlatform(normalized)
  if (mpPlatform) {
    return {
      runMini: true,
      runWeb: false,
      mpPlatform,
      label: mpPlatform,
    }
  }
  logger.warn(`未识别的平台 "${rawPlatform}"，已回退到 ${DEFAULT_MP_PLATFORM}`)
  return {
    runMini: true,
    runWeb: false,
    mpPlatform: DEFAULT_MP_PLATFORM,
    label: DEFAULT_MP_PLATFORM,
  }
}

function createInlineConfig(mpPlatform: MpPlatform | undefined): InlineConfig | undefined {
  if (!mpPlatform) {
    return undefined
  }
  return {
    weapp: {
      platform: mpPlatform,
    },
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
    logger.info(`- …其余 ${duplicates.length - limit} 项请使用 \`weapp-vite analyze --json\` 查看`)
  }
}

cli
  .option('-c, --config <file>', `[string] use specified config file`)
  .option('--base <path>', `[string] public base path (default: /)`, {
    type: [convertBase],
  })
  .option('-l, --logLevel <level>', `[string] info | warn | error | silent`)
  .option('--clearScreen', `[boolean] allow/disable clear screen when logging`)
  .option('-d, --debug [feat]', `[string | boolean] show debug logs`)
  .option('-f, --filter <filter>', `[string] filter debug logs`)
  .option('-m, --mode <mode>', `[string] set env mode`)

cli
  .command('[root]', 'start dev server') // default command
  .alias('serve') // the command is called 'serve' in Vite's API
  .alias('dev') // alias to align with the script name
  .option('--skipNpm', `[boolean] if skip npm build`)
  .option('-o, --open', `[boolean] open ide`)
  .option('-p, --platform <platform>', `[string] target platform (weapp | h5)`)
  .action(async (root: string, options: GlobalCLIOptions) => {
    filterDuplicateOptions(options)
    const configFile = resolveConfigFile(options)
    const targets = resolveRuntimeTargets(options)
    logRuntimeTarget(targets)
    const inlineConfig = createInlineConfig(targets.mpPlatform)
    const { buildService, configService, webService } = await createCompilerContext({
      cwd: root,
      mode: options.mode ?? 'development',
      isDev: true,
      configFile,
      inlineConfig,
    })
    if (targets.runMini) {
      await buildService.build(options)
    }
    let webServer: ViteDevServer | undefined
    if (targets.runWeb) {
      try {
        webServer = await webService?.startDevServer()
      }
      catch (error) {
        logger.error(error)
        throw error
      }
    }
    if (targets.runMini) {
      logBuildAppFinish(configService, webServer, { skipWeb: !targets.runWeb })
    }
    else if (targets.runWeb) {
      logBuildAppFinish(configService, webServer, { skipMini: true })
    }
    if (options.open && targets.runMini) {
      await openIde()
    }
  })

cli
  .command('build [root]', 'build for production')
  .option('--target <target>', `[string] transpile target (default: 'modules')`)
  .option('--outDir <dir>', `[string] output directory (default: dist)`)
  .option('-p, --platform <platform>', `[string] target platform (weapp | h5)`)
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
  .action(async (root: string, options: GlobalCLIOptions) => {
    filterDuplicateOptions(options)
    const configFile = resolveConfigFile(options)
    const targets = resolveRuntimeTargets(options)
    logRuntimeTarget(targets)
    const inlineConfig = createInlineConfig(targets.mpPlatform)
    const { buildService, configService, webService } = await createCompilerContext({
      cwd: root,
      mode: options.mode ?? 'production',
      configFile,
      inlineConfig,
    })
    // 会清空 npm
    if (targets.runMini) {
      await buildService.build(options)
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
      await openIde()
    }
  })

cli
  .command('analyze [root]', 'analyze 两端包体与源码映射')
  .option('--json', `[boolean] 输出 JSON 结果`)
  .option('--output <file>', `[string] 将分析结果写入指定文件（JSON）`)
  .option('-p, --platform <platform>', `[string] target platform (weapp | h5)`)
  .action(async (root: string, options: AnalyzeCLIOptions) => {
    filterDuplicateOptions(options)
    const configFile = resolveConfigFile(options)
    const targets = resolveRuntimeTargets(options)
    logRuntimeTarget(targets)
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
      })
      const result = await analyzeSubpackages(ctx)
      const outputJson = coerceBooleanOption(options.json)
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
        logger.success(`分析结果已写入 ${relativeOutput}`)
        writtenPath = resolvedOutputPath
      }
      if (outputJson) {
        if (!writtenPath) {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
        }
      }
      else {
        printAnalysisSummary(result)
      }
    }
    catch (error) {
      logger.error(error)
      process.exitCode = 1
    }
  })

cli
  .command('init')
  .action(async () => {
    try {
      await initConfig({
        command: 'weapp-vite',
      })
    }
    catch (error) {
      logger.error(error)
    }
  })

cli
  .command('open')
  .action(async () => {
    await openIde()
  })

cli
  .command('npm')
  .alias('build:npm')
  .alias('build-npm')
  .action(async () => {
    try {
      await parse(['build-npm', '-p'])
    }
    catch (error) {
      logger.error(error)
    }
  })

cli
  .command('g [filepath]', 'generate component')
  .alias('generate')
  .option('-a, --app', 'type app')
  .option('-p, --page', 'type app')
  .option('-n, --name <name>', 'filename')
  .action(async (
    filepath: string,
    options: { app: boolean, page: boolean, name?: string } & Pick<GlobalCLIOptions, 'config' | 'c'>,
  ) => {
    const config = await loadConfig(resolveConfigFile(options))
    let type: GenerateType = 'component'
    let fileName: string | undefined = options.name
    if (options.app) {
      type = 'app'
      if (filepath === undefined) {
        filepath = ''
      }
      fileName = 'app'
    }
    if (filepath === undefined) {
      logger.error('weapp-vite generate <outDir> 命令必须传入路径参数 outDir')
      return
    }
    if (options.page) {
      type = 'page'
    }
    const generateOptions = config?.config.weapp?.generate
    fileName = generateOptions?.filenames?.[type] ?? fileName
    await generate({
      outDir: path.join(generateOptions?.dirs?.[type] ?? '', filepath),
      type,
      fileName,
      extensions: generateOptions?.extensions,
      templates: generateOptions?.templates,
    })
  })

cli
  .command('create [outDir]', 'create project')
  .option('-t, --template <type>', 'template type')
  .action(async (outDir: string, options: { template?: string }) => {
    await createProject(outDir, options.template as TemplateName)
  })

cli.help()
cli.version(VERSION)
cli.parse()
