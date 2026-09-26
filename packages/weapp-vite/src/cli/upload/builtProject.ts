import type { ConfigService } from '../../context'
import type { UploadCLIOptions } from './options'
import type { UploadAction, UploadContext, UploadPlatform } from './types'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import logger from '../../logger'
import { getProjectPlatformOptions } from '../../platform'
import { resolveWeappViteHostMeta } from '../../pluginHost'
import { loadUploadEnv } from './env'
import { prepareUpload, resolveUploadPlatforms } from './index'
import { executeUpload } from './process'
import { validateUploadProject } from './project'
import { redactUploadSecrets } from './tools'

interface UploadTarget {
  platform: UploadPlatform
  context: UploadContext
  outDir?: string
  sourceConfigPath?: string
}

/** 仅由显式上传或预览入口读取参数，不执行构建或调用平台工具。 */
export async function createUploadTarget(config: ConfigService, options: UploadCLIOptions, action: UploadAction): Promise<UploadTarget> {
  if (config.weappLibConfig?.enabled || config.pluginOnly) {
    throw new Error(`${action} 仅支持完整小程序项目，不支持组件库或独立插件构建。`)
  }
  const platform = resolveUploadPlatforms(config.platform)[0]!
  const uploadConfig = action === 'upload' ? config.weappViteConfig.upload : undefined
  const version = (options.uv ?? uploadConfig?.version ?? config.packageJson.version)?.trim() ?? ''
  if (action === 'upload' && !version) {
    throw new Error('请通过 --uv、weapp.upload.version 或项目 package.json 的 version 指定上传版本。')
  }
  const desc = (options.desc ?? uploadConfig?.desc)?.trim() || `${config.packageJson.name ?? platform}${version ? `@${version}` : ''}`
  const env = options.dryRun
    ? {}
    : await loadUploadEnv(config.cwd, config.mode, config.inlineConfig.root, config.inlineConfig.envDir)
  const { projectConfigFileName } = getProjectPlatformOptions(config.platform)
  const projectPath = config.multiPlatform.enabled
    ? path.dirname(config.outDir)
    : path.dirname(config.projectConfigPath ?? path.join(config.cwd, projectConfigFileName))
  const appid: unknown = config.projectConfig.appid ?? config.projectConfig.appId
  const target: UploadTarget = {
    platform,
    sourceConfigPath: config.projectConfigPath,
    context: {
      cwd: config.cwd,
      projectPath,
      appid: typeof appid === 'string' ? appid : undefined,
      version,
      desc,
      qrCodePath: action === 'preview' && !options.dryRun
        ? path.join(config.cwd, '.weapp-vite', 'preview', `${platform}-${randomUUID()}.png`)
        : undefined,
      env: { ...process.env, ...env },
    },
  }
  // 项目配置目录不是实际输出目录；只接受本轮打包器真正写出的主应用。
  const plugins = config.inlineConfig.plugins ??= []
  plugins.push({
    name: 'weapp-vite:upload-output',
    apply: viteConfig => resolveWeappViteHostMeta(viteConfig)?.runtime === 'miniprogram',
    writeBundle(output, bundle) {
      if (output.dir && Object.hasOwn(bundle, 'app.json')) {
        target.outDir = path.resolve(output.dir)
      }
    },
  })
  return target
}

/** 只消费本次构建的产物；产物校验通过前不会准备凭据或调用平台工具。 */
export async function executeUploadTarget(target: UploadTarget, options: UploadCLIOptions, action: UploadAction) {
  const { platform, context } = target
  if (!target.outDir) {
    throw new Error('本次构建未写出 app.json，已阻止上传或预览旧产物。')
  }
  await validateUploadProject({
    platform,
    projectPath: context.projectPath,
    outDir: target.outDir,
    sourceConfigPath: target.sourceConfigPath,
  })
  if (options.dryRun) {
    logger.success(`[${action}:${platform}] dry-run：构建完成，未校验凭据或调用平台工具。项目：${path.relative(context.cwd, context.projectPath) || '.'}`)
    return
  }
  const upload = await prepareUpload(platform, context, action)
  const result = await executeUpload(platform, context, upload.secrets, action)
  if (action === 'preview') {
    if (!result) {
      throw new Error('预览工具未返回二维码或预览链接。')
    }
    for (const [label, value] of [
      ['二维码图片', result.qrCodeUrl],
      ['预览链接', result.previewUrl],
      ['二维码文件', result.qrCodeFile && path.relative(context.cwd, result.qrCodeFile)],
    ]) {
      if (value) {
        logger.info(`[preview:${platform}] ${label}：${redactUploadSecrets(value, upload.secrets)}`)
      }
    }
    logger.success(`[preview:${platform}] 预览已生成（未上传开发版本、未提审、未正式发布）。`)
  }
  else {
    logger.success(`[upload:${platform}] ${context.version} 上传完成（未提审、未正式发布）。`)
  }
}
