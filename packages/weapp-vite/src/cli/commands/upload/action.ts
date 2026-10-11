import type { UploadCLIOptions } from '../../upload/options'
import type { UploadReport, UploadReportItem } from '../../upload/report'
import type { UploadAction, UploadPlatform } from '../../upload/types'
import path from 'node:path'
import process from 'node:process'
import { createCompilerContext } from '../../../createContext'
import logger from '../../../logger'
import { setCommandNodeEnv } from '../../nodeEnv'
import { filterDuplicateOptions, resolveConfigFile } from '../../options'
import { terminateStaleSassEmbeddedProcess } from '../../processCleanup'
import { createInlineConfig, resolveRuntimeTargets } from '../../runtime'
import { resolveUploadPlatforms } from '../../upload'
import { prepareAutoUploadMetadata } from '../../upload/autoMetadata'
import { createUploadTarget, executeUploadTarget } from '../../upload/builtProject'
import { UploadExecutionError } from '../../upload/executionError'
import { resolveUploadTimeout } from '../../upload/options'
import { UploadCommandError } from '../../upload/report'

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
