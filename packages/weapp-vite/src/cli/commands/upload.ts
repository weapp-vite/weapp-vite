import type { CAC } from 'cac'
import type { UploadCLIOptions } from '../upload/options'
import type { UploadAction, UploadPlatform } from '../upload/types'
import path from 'node:path'
import process from 'node:process'
import { createCompilerContext } from '../../createContext'
import logger from '../../logger'
import { setCommandNodeEnv } from '../nodeEnv'
import { filterDuplicateOptions, resolveConfigFile } from '../options'
import { terminateStaleSassEmbeddedProcess } from '../processCleanup'
import { createInlineConfig, resolveRuntimeTargets } from '../runtime'
import { resolveUploadPlatforms } from '../upload'
import { createUploadTarget, executeUploadTarget } from '../upload/builtProject'
import { readUploadMetadata } from '../upload/options'
import { scheduleCompletedProductionBuildExit } from './build'

async function buildUploadTarget(cwd: string, platform: UploadPlatform | undefined, options: UploadCLIOptions, action: UploadAction) {
  const targets = resolveRuntimeTargets({ platform })
  const ctx = await createCompilerContext({
    cwd,
    mode: options.mode ?? 'production',
    configFile: resolveConfigFile(options),
    inlineConfig: createInlineConfig(targets),
    cliPlatform: platform,
    projectConfigPath: options.projectConfig,
    emitDefaultAutoImportOutputs: false,
    preloadAppEntry: false,
  })
  try {
    const target = await createUploadTarget(ctx.configService, options, action)
    logger.info(`[${action}:${target.platform}] 构建${target.context.version ? ` ${target.context.version}` : ''}`)
    await ctx.buildService.build({})
    return target
  }
  finally {
    ctx.watcherService.closeAll()
    terminateStaleSassEmbeddedProcess()
  }
}

export async function runUploadCommand(root: string | undefined, options: UploadCLIOptions, action: UploadAction = 'upload') {
  filterDuplicateOptions(options)
  const platforms = resolveUploadPlatforms(options.platform ?? options.p)
  setCommandNodeEnv('production')
  const cwd = path.resolve(root ?? process.cwd())
  for (const platform of platforms) {
    const target = await buildUploadTarget(cwd, platform, options, action)
    await executeUploadTarget(target, options, action)
  }
}

export function registerUploadCommand(cli: CAC) {
  cli
    .command('upload [root]', 'build and upload mini programs (does not submit for review or publish)')
    .option('-p, --platform <platform>', '[string] weapp | alipay | tt | xhs | jd | swan; comma-separated targets or all')
    .option('--project-config <path>', '[string] project config path')
    .option('--uv <version>', '[string] upload version (default: weapp.upload.version or package.json version)')
    .option('--desc <text>', '[string] upload description (default: weapp.upload.desc or project name and version)')
    .option('--dry-run', '[boolean] build without validating upload credentials or uploading')
    .action(async (root: string | undefined, options: UploadCLIOptions) => {
      await runUploadCommand(root, { ...options, ...readUploadMetadata(cli) })
      scheduleCompletedProductionBuildExit({}, undefined)
    })
}

export function registerPreviewCommand(cli: CAC) {
  cli
    .command('preview [root]', 'build mini programs and generate preview QR codes or links')
    .option('-p, --platform <platform>', '[string] weapp | alipay | tt | xhs | jd | swan; comma-separated targets or all')
    .option('--project-config <path>', '[string] project config path')
    .option('--desc <text>', '[string] preview description')
    .option('--dry-run', '[boolean] build without validating credentials or generating previews')
    .action(async (root: string | undefined, options: UploadCLIOptions) => {
      await runUploadCommand(root, { ...options, ...readUploadMetadata(cli) }, 'preview')
      scheduleCompletedProductionBuildExit({}, undefined)
    })
}
