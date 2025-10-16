import type { TemplateName } from '@weapp-core/init'
import type { GenerateType } from '@weapp-core/schematics'
import type { InlineConfig, ViteDevServer } from 'vite'
import type { ConfigService } from './context'
import type { LogLevel } from './logger'
import type { MpPlatform } from './types'
import process from 'node:process'
import { createProject, initConfig } from '@weapp-core/init'
import { defu } from '@weapp-core/shared'
import { cac } from 'cac'
import { resolveCommand } from 'package-manager-detector/commands'
import path from 'pathe'
import { loadConfigFromFile } from 'vite'
import { parse } from 'weapp-ide-cli'
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
  'p'?: string
  'platform'?: string
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
