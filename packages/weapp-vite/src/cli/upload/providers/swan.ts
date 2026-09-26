import type { PreparedUpload, PreviewResult, UploadAction, UploadContext } from '../types'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { requireUploadAppId, requireUploadEnv, runUploadCli } from '../tools'

/** 使用官方百度 CLI 上传或预览普通小程序，JSON 模式会在认证失败时拒绝交互登录。 */
export async function prepareSwanUpload(context: UploadContext, action: UploadAction = 'upload'): Promise<PreparedUpload> {
  const token = requireUploadEnv(context, 'SWAN_UPLOAD_TOKEN')
  const minSwanVersion = requireUploadEnv(context, 'SWAN_MIN_VERSION')
  const appid = requireUploadAppId(context)
  if (action === 'upload' && !/^\d+(?:\.\d+){1,3}$/.test(context.version)) {
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
    async run() {
      if (action === 'preview') {
        // 与官方 execSwanCommand 一致，使用标记区分结果 JSON 和编译日志。
        const output = await runUploadCli({
          ...context,
          env: { ...context.env, IS_NODE_JS: 'true' },
        }, 'swan-toolkit', 'swan', [
          'preview',
          '--project-path',
          context.projectPath,
          '--token',
          token,
          '--min-swan-version',
          minSwanVersion,
          '--json',
        ], secrets, true)
        let result: { list?: { url?: unknown }[] } | null
        try {
          const marker = /^NODE_JS_ENV_RESULT:/m.exec(output)
          if (!marker) {
            throw new Error('缺少官方 JSON 结果标记。')
          }
          result = JSON.parse(output.slice(marker.index + marker[0].length))
        }
        catch {
          throw new Error('百度预览未返回有效的 JSON 结果。')
        }
        const list = result?.list
        // 官方 CLI 有兼容包时依次返回低版本、默认版本；统一预览选择末项默认版本。
        const previewUrl = Array.isArray(list) ? list[list.length - 1]?.url : undefined
        if (typeof previewUrl !== 'string' || !previewUrl.trim()) {
          throw new Error('百度预览未返回有效的预览链接。')
        }
        // url 会传给官方二维码生成器，是二维码内容而不是图片地址。
        return { previewUrl: previewUrl.trim() } satisfies PreviewResult
      }
      return runUploadCli(context, 'swan-toolkit', 'swan', [
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
      ], secrets)
    },
  }
}
