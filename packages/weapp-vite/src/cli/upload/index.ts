import type { PreparedUpload, UploadAction, UploadContext, UploadPlatform } from './types'
import { resolveMiniPlatform } from '../../platform'
import { prepareAlipayUpload } from './providers/alipay'
import { prepareDouyinUpload } from './providers/douyin'
import { prepareJdUpload } from './providers/jd'
import { prepareSwanUpload } from './providers/swan'
import { prepareWechatUpload } from './providers/wechat'
import { prepareXhsUpload } from './providers/xhs'

const providers: Record<UploadPlatform, (context: UploadContext, action: UploadAction) => Promise<PreparedUpload>> = {
  weapp: prepareWechatUpload,
  alipay: prepareAlipayUpload,
  tt: prepareDouyinUpload,
  xhs: prepareXhsUpload,
  jd: prepareJdUpload,
  swan: prepareSwanUpload,
}

export function resolveUploadPlatforms(value?: string): (UploadPlatform | undefined)[] {
  if (value === undefined) {
    return [undefined]
  }
  if (value === 'all') {
    return Object.keys(providers) as UploadPlatform[]
  }
  const platforms = value.split(',').map((name) => {
    const platform = resolveMiniPlatform(name)
    if (!platform || !Object.hasOwn(providers, platform)) {
      throw new Error(`不支持上传或预览平台 "${name}"，可选：${Object.keys(providers).join(', ')} 或 all。`)
    }
    return platform as UploadPlatform
  })
  return [...new Set(platforms)]
}

export function prepareUpload(platform: string, context: UploadContext, action: UploadAction = 'upload'): Promise<PreparedUpload> {
  if (!Object.hasOwn(providers, platform)) {
    throw new Error(`不支持上传或预览平台 "${platform}"。`)
  }
  return providers[platform as UploadPlatform](context, action)
}
