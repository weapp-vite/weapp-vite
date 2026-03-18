import type { CAC } from 'cac'
import type { ResolvedConfig } from 'vite'
import type { GlobalCLIOptions } from '../types'
import path from 'pathe'
import { createCompilerContext } from '../../createContext'
import logger from '../../logger'
import { findAutoImportCandidates, shouldBootstrapAutoImportWithoutGlobs } from '../../plugins/autoImport'
import { getAutoImportConfig } from '../../runtime/autoImport/config'
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

export function registerPrepareCommand(cli: CAC) {
  cli
    .command('prepare [...input]', 'generate .weapp-vite support files')
    .action(async (input: string[] | undefined, options: GlobalCLIOptions) => {
      try {
        filterDuplicateOptions(options)
        const cwd = path.resolve(resolvePrepareRoot(input))
        const ctx = await createCompilerContext({
          cwd,
          isDev: false,
          mode: typeof options.mode === 'string' ? options.mode : 'development',
          configFile: resolveConfigFile(options),
        })

        if (ctx.autoRoutesService.isEnabled()) {
          await ctx.autoRoutesService.ensureFresh()
        }

        const autoImportConfig = getAutoImportConfig(ctx.configService)
        if (autoImportConfig) {
          ctx.autoImportService.reset()
          const globs = autoImportConfig.globs
          if (Array.isArray(globs) && globs.length > 0) {
            const files = await findAutoImportCandidates({
              ctx,
              resolvedConfig: {
                build: {
                  outDir: ctx.configService.outDir,
                },
              } as ResolvedConfig,
            }, globs)
            await Promise.all(files.map(file => ctx.autoImportService.registerPotentialComponent(file)))
          }
          else if (!shouldBootstrapAutoImportWithoutGlobs(autoImportConfig)) {
            logger.info('未检测到可预生成的 auto import 输出。')
          }

          await ctx.autoImportService.awaitManifestWrites()
        }

        logger.info('已生成 .weapp-vite 支持文件。')
      }
      catch (error) {
        logger.warn(`[prepare] ${formatPrepareSkipMessage(error)}`)
      }
    })
}
