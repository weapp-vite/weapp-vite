import type { PreparedUpload, UploadContext } from '../types'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { loadUploadPackage, requireUploadAppId, requireUploadEnv } from '../tools'

interface XhsUploadCi {
  core: { login: () => Promise<void> }
  setAppConfig: (options: { appId: string, config: { token: string } }) => void
  upload: (options: {
    project: { projectPath: string }
    version: string
    desc: string
    verbose: false
  }) => Promise<unknown>
}

interface XhsUploadModule {
  CI: new () => XhsUploadCi
}

/** 使用独立的官方 CI 实例上传小红书项目，禁止回退到扫码登录。 */
export async function prepareXhsUpload(context: UploadContext): Promise<PreparedUpload> {
  const token = requireUploadEnv(context, 'XHS_UPLOAD_TOKEN')
  const appid = context.env.XHS_APP_ID?.trim() || requireUploadAppId(context)
  if (!context.version.trim() || !context.desc.trim()) {
    throw new Error('小红书上传需要非空版本号和版本描述。')
  }
  const projectConfig = JSON.parse(await readFile(path.join(context.projectPath, 'project.config.json'), 'utf8')) as { appid?: unknown } | null
  if (projectConfig?.appid !== appid) {
    throw new Error('小红书 project.config.json 的 appid 必须与 XHS_APP_ID 或项目配置的 AppID 一致，禁止向其他小程序上传。')
  }

  return {
    secrets: [token],
    async run() {
      const { CI } = await loadUploadPackage<XhsUploadModule>('xhs-mp-cli/dist/ci.js', context.cwd)
      const sdk = new CI()
      sdk.core.login = async () => {
        throw new Error('小红书上传仅支持 Token 认证，禁止扫码登录，请检查 XHS_UPLOAD_TOKEN 和项目 AppID。')
      }
      sdk.setAppConfig({ appId: appid, config: { token } })
      return sdk.upload({
        project: { projectPath: context.projectPath },
        version: context.version,
        desc: context.desc,
        verbose: false,
      })
    },
  }
}
