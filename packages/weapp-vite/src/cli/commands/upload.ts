import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../types'
import type { UploadContext, UploadPlatform } from '../upload/types'
import path from 'node:path'
import process from 'node:process'
import { createCompilerContext } from '../../createContext'
import logger from '../../logger'
import { getProjectPlatformOptions } from '../../platform'
import { setCommandNodeEnv } from '../nodeEnv'
import { filterDuplicateOptions, resolveConfigFile } from '../options'
import { terminateStaleSassEmbeddedProcess } from '../processCleanup'
import { createInlineConfig, resolveRuntimeTargets } from '../runtime'
import { prepareUpload, resolveUploadPlatforms } from '../upload'
import { loadUploadEnv } from '../upload/env'
import { executeUpload } from '../upload/process'
import { validateUploadProject } from '../upload/project'
import { scheduleCompletedProductionBuildExit } from './build'

interface UploadCLIOptions extends GlobalCLIOptions {
  uploadVersion?: string
  desc?: string
  dryRun?: boolean
}

async function buildUploadTarget(cwd: string, platform: UploadPlatform | undefined, options: UploadCLIOptions) {
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
    const config = ctx.configService
    if (config.weappLibConfig?.enabled || config.pluginOnly) {
      throw new Error('upload 仅支持完整小程序项目，不支持组件库或独立插件构建。')
    }
    const resolvedPlatform = resolveUploadPlatforms(config.platform)[0]!
    const version = (options.uploadVersion ?? config.packageJson.version)?.trim()
    if (!version) {
      throw new Error('请通过 --upload-version 或项目 package.json 的 version 指定上传版本。')
    }
    const desc = options.desc?.trim() || `${config.packageJson.name ?? resolvedPlatform}@${version}`
    const env = options.dryRun
      ? {}
      : await loadUploadEnv(config.cwd, config.mode, config.inlineConfig.root, config.inlineConfig.envDir)
    const { projectConfigFileName } = getProjectPlatformOptions(config.platform)
    const projectPath = config.multiPlatform.enabled
      ? path.dirname(config.outDir)
      : path.dirname(config.projectConfigPath ?? path.join(config.cwd, projectConfigFileName))
    const appid: unknown = config.projectConfig.appid ?? config.projectConfig.appId
    const context: UploadContext = {
      cwd: config.cwd,
      projectPath,
      appid: typeof appid === 'string' ? appid : undefined,
      version,
      desc,
      env: { ...process.env, ...env },
    }
    logger.info(`[upload:${resolvedPlatform}] 构建 ${version}`)
    await ctx.buildService.build({})
    await validateUploadProject({
      platform: resolvedPlatform,
      projectPath,
      outDir: config.outDir,
      sourceConfigPath: config.projectConfigPath,
    })
    return { platform: resolvedPlatform, context }
  }
  finally {
    ctx.watcherService.closeAll()
    terminateStaleSassEmbeddedProcess()
  }
}

export async function runUploadCommand(root: string | undefined, options: UploadCLIOptions) {
  filterDuplicateOptions(options)
  const platforms = resolveUploadPlatforms(options.platform ?? options.p)
  setCommandNodeEnv('production')
  const cwd = path.resolve(root ?? process.cwd())
  for (const platform of platforms) {
    const target = await buildUploadTarget(cwd, platform, options)
    if (options.dryRun) {
      logger.success(`[upload:${target.platform}] dry-run：构建完成，未校验上传凭据或调用上传工具。项目：${path.relative(cwd, target.context.projectPath) || '.'}`)
      continue
    }
    const upload = await prepareUpload(target.platform, target.context)
    await executeUpload(target.platform, target.context, upload.secrets)
    logger.success(`[upload:${target.platform}] ${target.context.version} 上传完成（未提审、未正式发布）。`)
  }
}

export function registerUploadCommand(cli: CAC) {
  cli
    .command('upload [root]', 'build and upload mini programs (does not submit for review or publish)')
    .option('-p, --platform <platform>', '[string] weapp | alipay | tt | xhs | jd | swan; comma-separated targets or all')
    .option('--project-config <path>', '[string] project config path')
    .option('--upload-version <version>', '[string] upload version (default: package.json version)')
    .option('--desc <text>', '[string] upload description')
    .option('--dry-run', '[boolean] build without validating upload credentials or uploading')
    .action(async (root: string | undefined, options: UploadCLIOptions) => {
      await runUploadCommand(root, options)
      scheduleCompletedProductionBuildExit({}, undefined)
    })
}
