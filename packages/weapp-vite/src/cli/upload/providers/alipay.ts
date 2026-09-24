import type { PreparedUpload, UploadContext } from '../types'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { loadUploadPackage, requireUploadAppId, requireUploadEnv } from '../tools'

interface MinidevSdk {
  minidev: {
    upload: (options: {
      appId: string
      project: string
      identityKeyPath: string
      clientType: 'alipay'
      version: string
      versionDescription: string
      experience: false
    }) => Promise<{ version: string, experienceQrCodeUrl?: string }>
  }
}

/** 校验支付宝身份密钥与版本，只在执行阶段加载并调用官方 SDK。 */
export async function prepareAlipayUpload(context: UploadContext): Promise<PreparedUpload> {
  const appId = requireUploadAppId({ ...context, appid: context.env.ALIPAY_APP_ID?.trim() || context.appid })
  const identityKeyPath = path.resolve(context.cwd, requireUploadEnv(context, 'ALIPAY_IDENTITY_KEY_PATH'))
  if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(context.version)
    || context.version.split('.').some(part => Number(part) > 2147483647)) {
    throw new Error('支付宝上传版本必须为 x.y.z 格式，各段不能有前导零且不能超过 2147483647。')
  }
  if (context.desc.length >= 200) {
    throw new Error('支付宝上传描述必须少于 200 个字符。')
  }

  let identityKey: string
  try {
    if (!(await stat(identityKeyPath)).isFile()) {
      throw new Error('not a file')
    }
    identityKey = await readFile(identityKeyPath, 'utf8')
  }
  catch {
    throw new Error('无法读取 ALIPAY_IDENTITY_KEY_PATH 指定的身份密钥文件；相对路径以项目根目录为基准。')
  }
  const secrets = [identityKey]
  let identity: unknown
  try {
    identity = JSON.parse(identityKey, (_key, value: unknown) => {
      if (typeof value === 'string' && value) {
        secrets.push(value)
      }
      return value
    })
  }
  catch {
    throw new Error('ALIPAY_IDENTITY_KEY_PATH 必须指向从支付宝开放平台获取的 JSON 身份密钥文件。')
  }
  const alipay = identity && typeof identity === 'object' && 'alipay' in identity ? identity.alipay : undefined
  if (!alipay || typeof alipay !== 'object' || !('authentication' in alipay) || !alipay.authentication) {
    throw new Error('支付宝身份密钥文件缺少 alipay.authentication。请从开放平台重新获取身份密钥。')
  }

  return {
    secrets,
    async run() {
      const sdk = await loadUploadPackage<MinidevSdk>('minidev', context.cwd)
      return sdk.minidev.upload({
        appId,
        project: context.projectPath,
        identityKeyPath,
        clientType: 'alipay',
        version: context.version,
        versionDescription: context.desc,
        experience: false,
      })
    },
  }
}
