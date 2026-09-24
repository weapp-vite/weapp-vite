import type { PreparedUpload, UploadContext } from '../types'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { loadUploadPackage, requireUploadAppId, requireUploadEnv } from '../tools'

interface WechatProject {
  appid: string
  projectPath: string
  privateKey: string
}

interface WechatCi {
  Project: new (options: {
    appid: string
    type: 'miniProgram'
    projectPath: string
    privateKey: string
    ignores: string[]
  }) => WechatProject
  upload: (options: {
    project: WechatProject
    version: string
    desc: string
    robot?: number
    setting: { useProjectConfig: true }
  }) => Promise<{
    subPackageInfo?: { name: string, size: number }[]
    pluginInfo?: { pluginProviderAppid: string, version: string, size: number }[]
    devPluginId?: string
    strUint64Version?: string
  }>
}

/** 校验微信上传凭据，SDK 自行读取 IDE 项目中的 miniprogramRoot。 */
export async function prepareWechatUpload(context: UploadContext): Promise<PreparedUpload> {
  const appid = requireUploadAppId({ ...context, appid: context.env.WEAPP_CI_APPID?.trim() || context.appid })
  const keyPath = path.resolve(context.cwd, requireUploadEnv(context, 'WEAPP_CI_PRIVATE_KEY_PATH'))
  const robotValue = context.env.WEAPP_CI_ROBOT?.trim()
  if (robotValue !== undefined && !/^0*(?:[1-9]|[12]\d|30)$/.test(robotValue)) {
    throw new Error('WEAPP_CI_ROBOT 必须是 1 到 30 之间的整数。')
  }
  const robot = robotValue === undefined ? undefined : Number(robotValue)

  let privateKey: string
  try {
    if (!(await stat(keyPath)).isFile()) {
      throw new Error('not a file')
    }
    privateKey = await readFile(keyPath, 'utf8')
  }
  catch {
    throw new Error('无法读取 WEAPP_CI_PRIVATE_KEY_PATH 指定的私钥文件；相对路径以项目根目录为基准。')
  }
  if (!privateKey.trim()) {
    throw new Error('WEAPP_CI_PRIVATE_KEY_PATH 指定的私钥文件不能为空。')
  }

  return {
    secrets: [privateKey, privateKey.trim()],
    async run() {
      const ci = await loadUploadPackage<WechatCi>('miniprogram-ci', context.cwd)
      const project = new ci.Project({
        appid,
        type: 'miniProgram',
        projectPath: context.projectPath,
        privateKey,
        ignores: ['node_modules/**/*'],
      })
      return ci.upload({
        project,
        version: context.version,
        desc: context.desc,
        robot,
        setting: { useProjectConfig: true },
      })
    },
  }
}
