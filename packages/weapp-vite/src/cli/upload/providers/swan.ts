import type { PreparedUpload, UploadContext } from '../types'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { requireUploadAppId, requireUploadEnv, runUploadCli } from '../tools'

/** 使用官方百度 CLI 上传普通小程序，JSON 模式会在认证失败时拒绝交互登录。 */
export async function prepareSwanUpload(context: UploadContext): Promise<PreparedUpload> {
  const token = requireUploadEnv(context, 'SWAN_UPLOAD_TOKEN')
  const minSwanVersion = requireUploadEnv(context, 'SWAN_MIN_VERSION')
  const appid = requireUploadAppId(context)
  if (!/^\d+(?:\.\d+){1,3}$/.test(context.version)) {
    throw new Error('百度上传版本号必须由 2 至 4 段数字组成，例如 1.0.0。')
  }
  const projectConfig = JSON.parse(await readFile(path.join(context.projectPath, 'project.swan.json'), 'utf8')) as { appid?: unknown, developType?: unknown } | null
  if (projectConfig?.appid !== appid) {
    throw new Error('百度 project.swan.json 的 appid 必须与项目配置的 AppID 一致，禁止向其他小程序上传。')
  }
  if (projectConfig.developType && projectConfig.developType !== 'normal') {
    throw new Error('百度统一上传仅支持普通小程序，不执行插件、动态库或扩展的发布。')
  }

  const secrets = [token]
  return {
    secrets,
    run: () => runUploadCli(context, 'swan-toolkit', 'swan', [
      'upload',
      '--project-path',
      context.projectPath,
      '--token',
      token,
      '--release-version',
      context.version,
      '--min-swan-version',
      minSwanVersion,
      '--desc',
      context.desc,
      '--json',
    ], secrets),
  }
}
