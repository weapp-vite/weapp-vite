import type { GenerateType } from '@weapp-core/schematics'
import type { LogLevel } from './logger'
import process from 'node:process'
import { initConfig } from '@weapp-core/init'
import { cac } from 'cac'
import { loadConfigFromFile } from 'vite'
import { parse } from 'weapp-ide-cli'
import { VERSION } from './constants'
import { createCompilerContext } from './context'
import logger from './logger'
import { generate } from './schematics'

const cli = cac('weapp-vite')

function loadConfig() {
  return loadConfigFromFile({
    command: 'serve',
    mode: 'development',
  }, undefined, process.cwd())
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
}

function filterDuplicateOptions<T extends object>(options: T) {
  for (const [key, value] of Object.entries(options)) {
    if (Array.isArray(value)) {
      options[key as keyof T] = value[value.length - 1]
    }
  }
}

function convertBase(v: any) {
  if (v === 0) {
    return ''
  }
  return v
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
  .action(async (root: string, options: GlobalCLIOptions) => {
    filterDuplicateOptions(options)
    const ctx = await createCompilerContext({
      cwd: root,
      mode: options.mode,
      isDev: true,
    })
    if (!options.skipNpm) {
      await ctx.buildNpm({ sourcemap: true })
    }
    await ctx.build()
  })

cli
  .command('build [root]', 'build for production')
  .option('--target <target>', `[string] transpile target (default: 'modules')`)
  .option('--outDir <dir>', `[string] output directory (default: dist)`)
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
  .action(async (root: string, options) => {
    filterDuplicateOptions(options)
    const ctx = await createCompilerContext({
      cwd: root,
      mode: options.mode,
    })
    // 会清空 npm
    await ctx.build()
    if (!options.skipNpm) {
      await ctx.buildNpm()
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
    try {
      await parse(['open', '-p'])
    }
    catch (error) {
      logger.error(error)
    }
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
  .command('gc [filepath]', 'generate component')
  .alias('g')
  .alias('generate')
  .option('-a, --app', 'type app')
  .option('-p, --page', 'type app')
  .option('-n, --name <name>', 'filename')
  .action(async (filepath: string, options: { app: boolean, page: boolean, name?: string }) => {
    const config = await loadConfig()
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
    await generate({
      outDir: filepath,
      type,
      fileName,
      extensions: config?.config.weapp?.generate?.extensions,
    })
  })

cli
  .command('ga [filepath]', 'generate app')
  .action(async (filepath?: string) => {
    const config = await loadConfig()
    await generate({
      outDir: filepath ?? '',
      type: 'app',
      fileName: 'app',
      extensions: config?.config.weapp?.generate?.extensions,
    })
  })

cli
  .command('gp <filepath>', 'generate page')
  .option('-n, --name <name>', 'filename')
  .action(async (filepath: string, options: { name?: string }) => {
    const config = await loadConfig()
    const fileName: string | undefined = options.name
    await generate({
      outDir: filepath,
      type: 'page',
      fileName,
      extensions: config?.config.weapp?.generate?.extensions,
    })
  })

cli.help()
cli.version(VERSION)
cli.parse()

// console.log(process._getActiveHandles());
// console.log(process._getActiveRequests());
