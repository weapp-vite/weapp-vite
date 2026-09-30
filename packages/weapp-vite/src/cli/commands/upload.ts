import type { CAC } from 'cac'
import type { UploadCLIOptions } from '../upload/options'
import type { UploadReport, UploadReportItem } from '../upload/report'
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
import { prepareAutoUploadMetadata } from '../upload/autoMetadata'
import { createUploadTarget, executeUploadTarget } from '../upload/builtProject'
import { UploadExecutionError } from '../upload/executionError'
import { readUploadMetadata, resolveUploadTimeout } from '../upload/options'
import { UploadCommandError } from '../upload/report'
import { scheduleCompletedProductionBuildExit } from './build'

async function buildUploadTarget(cwd: string, platform: UploadPlatform | undefined, options: UploadCLIOptions, action: UploadAction, item?: UploadReportItem) {
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
    if (item) {
      item.platform = target.platform
      item.requestedVersion = target.context.version
      item.stage = 'build'
    }
    logger.info(`[${action}:${target.platform}] 构建${target.context.version ? ` ${target.context.version}` : ''}`)
    await ctx.buildService.build({})
    return target
  }
  finally {
    ctx.watcherService.closeAll()
    terminateStaleSassEmbeddedProcess()
  }
}

export function runUploadCommand(root: string | undefined, options: UploadCLIOptions, action?: 'upload'): Promise<UploadReport>
export function runUploadCommand(root: string | undefined, options: UploadCLIOptions, action: 'preview'): Promise<void>
export function runUploadCommand(root: string | undefined, options: UploadCLIOptions, action: UploadAction): Promise<UploadReport | void>
export async function runUploadCommand(root: string | undefined, options: UploadCLIOptions, action: UploadAction = 'upload'): Promise<UploadReport | void> {
  filterDuplicateOptions(options)
  const platforms = resolveUploadPlatforms(options.platform ?? options.p)
  setCommandNodeEnv('production')
  const cwd = path.resolve(root ?? process.cwd())
  if (action === 'preview') {
    options = await prepareAutoUploadMetadata(cwd, options, action)
    for (const platform of platforms) {
      const target = await buildUploadTarget(cwd, platform, options, action)
      await executeUploadTarget(target, options, action)
    }
    return
  }

  const report: UploadReport = {
    schemaVersion: 1,
    action: 'upload',
    status: 'success',
    results: platforms.map(platform => ({ platform: platform ?? null, stage: 'prepare', status: 'not-run' })),
  }
  let active = report.results[0]!
  try {
    const timeoutMs = resolveUploadTimeout(options.timeout)
    options = await prepareAutoUploadMetadata(cwd, options, action)
    for (const item of report.results) {
      item.requestedVersion = options.uv?.trim()
    }
    for (const [index, platform] of platforms.entries()) {
      active = report.results[index]!
      const target = await buildUploadTarget(cwd, platform, options, action, active)
      active.stage = 'validate'
      const result = await executeUploadTarget(target, options, action, {
        timeoutMs,
        onUpload: () => { active.stage = 'upload' },
      })
      active.status = options.dryRun ? 'dry-run' : 'success'
      if (!options.dryRun) {
        active.result = result
      }
    }
    return report
  }
  catch (error) {
    report.status = 'failed'
    report.error = error instanceof Error ? error.message : String(error)
    active.status = 'failed'
    active.error = report.error
    if (error instanceof UploadExecutionError) {
      active.remoteOutcome = error.remoteOutcome
      if (error.remoteOutcome === 'unknown' && error.reason !== 'failed') {
        active.status = 'unknown'
      }
    }
    throw new UploadCommandError(report)
  }
}

export function registerUploadCommand(cli: CAC) {
  cli
    .command('upload [root]', 'build and upload mini programs (does not submit for review or publish)')
    .option('-p, --platform <platform>', '[string] weapp | alipay | tt | xhs | jd | swan; comma-separated targets or all')
    .option('--project-config <path>', '[string] project config path')
    .option('--uv <version>', '[string] upload version (default: weapp.upload.version or package.json version)')
    .option('--desc <text>', '[string] upload description (default: weapp.upload.desc or project name and version)')
    .option('--bump <release>', '[string] increment local package version once (patch | minor | major; dry-run does not write)')
    .option('--git-desc', '[boolean] use the latest Git commit subject as upload description')
    .option('--dry-run', '[boolean] build without validating upload credentials or uploading')
    .option('--json', '[boolean] write one upload report to stdout; send logs to stderr')
    .option('--timeout <seconds>', '[number] local timeout per platform SDK invocation, excluding build')
    .example('wv upload -p weapp')
    .example('wv upload -p xhs,tt --bump patch --git-desc --dry-run')
    .example('wv upload --project ./dist --version 1.2.3 --desc "release"  (deprecated IDE syntax; use wv ide upload to retain IDE behavior)')
    .action(async (root: string | undefined, options: UploadCLIOptions) => {
      return runUploadCommand(root, { ...options, ...readUploadMetadata(cli) })
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
