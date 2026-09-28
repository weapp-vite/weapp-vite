import type { PreviewResult, UploadContext } from './types'
import { stat } from 'node:fs/promises'
import path from 'node:path'

/** 只接受可展示的预览结果，文件必须由本次任务生成，不能沿用旧二维码。 */
export async function validatePreviewResult(value: unknown, context: UploadContext): Promise<PreviewResult> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('预览工具未返回二维码或预览链接。')
  }
  const input = value as Record<string, unknown>
  const result: PreviewResult = {}
  for (const key of ['qrCodeUrl', 'previewUrl'] as const) {
    if (input[key] === undefined) {
      continue
    }
    if (typeof input[key] !== 'string' || !input[key].trim()) {
      throw new Error('预览工具返回了无效链接。')
    }
    let url: URL
    try {
      url = new URL(input[key])
    }
    catch {
      throw new Error('预览工具返回了无效链接。')
    }
    if (url.username || url.password
      || (key === 'qrCodeUrl' && url.protocol !== 'http:' && url.protocol !== 'https:')
      || ['javascript:', 'data:', 'file:'].includes(url.protocol)) {
      throw new Error('预览工具返回了不支持的链接类型。')
    }
    result[key] = input[key]
  }
  if (input.qrCodeFile !== undefined) {
    if (typeof input.qrCodeFile !== 'string' || !context.qrCodePath
      || path.resolve(input.qrCodeFile) !== path.resolve(context.qrCodePath)) {
      throw new Error('预览工具返回的二维码文件不是本次任务的输出路径。')
    }
    const file = await stat(input.qrCodeFile)
    if (!file.isFile() || file.size === 0) {
      throw new Error('预览二维码文件不存在或为空。')
    }
    result.qrCodeFile = input.qrCodeFile
  }
  if (!result.qrCodeUrl && !result.previewUrl && !result.qrCodeFile) {
    throw new Error('预览工具未返回二维码或预览链接。')
  }
  return result
}
