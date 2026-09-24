import type { PreparedUpload, PreviewResult, UploadAction, UploadContext } from '../types'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { loadUploadPackage, requireUploadAppId, requireUploadEnv } from '../tools'

interface DouyinUploadSdk {
  setAppConfig: (options: { appid: string, config: { token: string } }) => void
  preview: (options: {
    project: { path: string }
    page: { path: string, query: string, scene: string, launchFrom: string, location: string }
    qrcode: { format: null }
    cache: boolean
    copyToClipboard: false
  }) => Promise<{ shortUrl?: unknown } | null | undefined>
  upload: (options: {
    project: { path: string }
    version: string
    changeLog: string
    qrcode: { format: null }
    copyToClipboard: false
  }) => Promise<unknown>
}

/** 校验抖音项目与 Token 对应的 AppID，仅在执行阶段调用官方上传或预览 SDK。 */
export async function prepareDouyinUpload(context: UploadContext, action: UploadAction = 'upload'): Promise<PreparedUpload> {
  const token = requireUploadEnv(context, 'TT_UPLOAD_TOKEN')
  const appid = context.env.TT_APP_ID?.trim() || requireUploadAppId(context)
  if (action === 'upload' && !/^\d+\.\d+\.\d+$/.test(context.version)) {
    throw new Error('抖音上传版本号必须为 x.y.z 格式。')
  }
  if (action === 'upload' && !context.desc.trim()) {
    throw new Error('抖音上传需要非空版本描述。')
  }
  const projectConfig = JSON.parse(await readFile(path.join(context.projectPath, 'project.config.json'), 'utf8')) as { appid?: unknown } | null
  if (projectConfig?.appid !== appid) {
    throw new Error('抖音 project.config.json 的 appid 必须与 TT_APP_ID 或项目配置的 AppID 一致，禁止向其他小程序上传。')
  }

  return {
    secrets: [token],
    async run() {
      const sdk = await loadUploadPackage<DouyinUploadSdk>('tt-ide-cli', context.cwd)
      // 官方类型使用 appid，README 中的 appId 示例与实际接口不一致。
      sdk.setAppConfig({ appid, config: { token } })
      if (action === 'preview') {
        const result = await sdk.preview({
          project: { path: context.projectPath },
          page: { path: '', query: '', scene: '', launchFrom: '', location: '' },
          qrcode: { format: null },
          cache: true,
          copyToClipboard: false,
        })
        if (typeof result?.shortUrl !== 'string' || !result.shortUrl.trim()) {
          throw new Error('抖音预览未返回有效的预览链接。')
        }
        // shortUrl 是二维码承载的预览短链，不是二维码图片地址。
        return { previewUrl: result.shortUrl.trim() } satisfies PreviewResult
      }
      return sdk.upload({
        project: { path: context.projectPath },
        version: context.version,
        changeLog: context.desc,
        qrcode: { format: null },
        copyToClipboard: false,
      })
    },
  }
}
