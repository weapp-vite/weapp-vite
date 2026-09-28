import type { UploadResult } from './types'
import { redactUploadSecrets } from './tools'

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function text(value: unknown, secrets: readonly string[]): string | undefined {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) {
    return undefined
  }
  return redactUploadSecrets(value.trim(), secrets)
}

function bytes(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

function link(value: unknown, secrets: readonly string[], scheme = false): string | undefined {
  if (typeof value !== 'string' || !value.trim() || /[\s\p{Cc}]/u.test(value.trim())) {
    return undefined
  }
  try {
    const url = new URL(value)
    const protocols = scheme ? ['http:', 'https:', 'baiduboxapp:', 'swan:'] : ['http:', 'https:']
    if (!protocols.includes(url.protocol) || url.username || url.password) {
      return undefined
    }
    return text(value, secrets)
  }
  catch {
    return undefined
  }
}

function base64(value: unknown, secrets: readonly string[]): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const source = value.trim()
  const content = source.replace(/^data:image\/(?:png|jpe?g|gif|webp);base64,/i, '')
  if (!content || !/^(?:[a-z\d+/]{4})*(?:[a-z\d+/]{2}==|[a-z\d+/]{3}=)?$/i.test(content)) {
    return undefined
  }
  return text(source, secrets)
}

/** 按官方上传结果选择字段；可选信息无效时丢弃，不把已完成上传改判失败。 */
export function normalizeUploadResult(platform: string, value: unknown, secrets: readonly string[]): UploadResult {
  const input = record(value)
  const result: UploadResult = {}
  if (!input) {
    return result
  }

  if (platform === 'weapp') {
    // strUint64Version 是内部标识，不是用户上传版本；普通小程序不推断版本。
    if (Array.isArray(input.subPackageInfo)) {
      result.subPackages = input.subPackageInfo.flatMap((value) => {
        const item = record(value)
        const name = text(item?.name, secrets)
        const size = bytes(item?.size)
        return name !== undefined && size !== undefined ? [{ name, size }] : []
      })
    }
    if (Array.isArray(input.pluginInfo)) {
      result.plugins = input.pluginInfo.flatMap((value) => {
        const item = record(value)
        const appid = text(item?.pluginProviderAppid, secrets)
        const version = text(item?.version, secrets)
        const size = bytes(item?.size)
        return appid !== undefined && version !== undefined && size !== undefined ? [{ appid, version, size }] : []
      })
    }
  }
  else if (platform === 'alipay') {
    const sdkVersion = text(input.version, secrets)
    const qrCodeUrl = link(input.experienceQrCodeUrl, secrets)
    if (sdkVersion !== undefined) {
      result.sdkVersion = sdkVersion
    }
    if (qrCodeUrl !== undefined) {
      result.qrCodeUrl = qrCodeUrl
    }
  }
  else if (platform === 'tt') {
    const previewUrl = link(input.shortUrl, secrets)
    const qrCodeFile = text(input.qrcodeFilePath, secrets)
    if (previewUrl !== undefined) {
      result.previewUrl = previewUrl
    }
    if (qrCodeFile !== undefined) {
      result.qrCodeFile = qrCodeFile
    }
  }
  else if (platform === 'jd') {
    const qrCodeUrl = link(input.imgUrl, secrets)
    const qrCodeBase64 = base64(input.base64Data, secrets)
    if (qrCodeUrl !== undefined) {
      result.qrCodeUrl = qrCodeUrl
    }
    if (qrCodeBase64 !== undefined) {
      result.qrCodeBase64 = qrCodeBase64
    }
  }
  else if (platform === 'swan') {
    // 与官方 CLI 一致，有兼容包时展示优化后的默认版本链接。
    const previewUrl = link(input.schemeUrlOpti, secrets, true) ?? link(input.schemeUrl, secrets, true)
    const fileSize = bytes(input.fileSize)
    if (previewUrl !== undefined) {
      result.previewUrl = previewUrl
    }
    if (fileSize !== undefined) {
      result.fileSize = fileSize
    }
    if (Array.isArray(input.warningList)) {
      result.warnings = input.warningList.flatMap((value) => {
        const warning = text(value, secrets)
        return warning === undefined ? [] : [warning]
      })
    }
  }
  // 小红书上传成功返回 null，没有可展示的结果字段。
  return result
}
