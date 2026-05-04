import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../types'
import path from 'pathe'
import { createCompilerContext } from '../../createContext'
import logger from '../../logger'
import { syncProjectSupportFiles } from '../../runtime/supportFiles'
import { filterDuplicateOptions, resolveConfigFile } from '../options'

function resolvePrepareRoot(input: string[] | undefined) {
  const values = Array.isArray(input) ? input.filter(item => typeof item === 'string' && item.length > 0) : []
  if (values.length === 0) {
    return '.'
  }
  const normalized = values[0] === 'prepare' ? values.slice(1) : values
  return normalized[0] ?? '.'
}

function formatPrepareSkipMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return `跳过 .weapp-vite 支持文件预生成：${message}`
}

function resolvePreparePlatform(options: GlobalCLIOptions) {
  return typeof options.platform === 'string'
    ? options.platform
    : typeof options.p === 'string'
      ? options.p
      : undefined
}

export function registerPrepareCommand(cli: CAC) {
  cli
    .command('prepare [...input]', 'generate .weapp-vite support files')
    .option('-p, --platform <platform>', `[string] target platform (weapp | h5)`)
    .action(async (input: string[] | undefined, options: GlobalCLIOptions) => {
      try {
        filterDuplicateOptions(options)
        const cwd = path.resolve(resolvePrepareRoot(input))
        const cliPlatform = resolvePreparePlatform(options)
        const ctx = await createCompilerContext({
          cwd,
          isDev: false,
          mode: typeof options.mode === 'string' ? options.mode : 'development',
          configFile: resolveConfigFile(options),
          configLoader: 'native',
          syncSupportFiles: false,
          preloadAppEntry: false,
          ...(cliPlatform ? { cliPlatform } : {}),
        })

        await syncProjectSupportFiles(ctx)

        logger.info('已生成 .weapp-vite 支持文件。')
      }
      catch (error) {
        logger.warn(`[prepare] ${formatPrepareSkipMessage(error)}`)
      }
    })
}
