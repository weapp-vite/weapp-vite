/**
 * @file 二维码核心 reader 纯函数解码入口。
 */
import type { QRCodeReaderInput } from './types'
import { normalizeQrCodeReaderResult } from './result'
import { createLegacyQrCodeReader } from './runtime'

/** decodeWithLegacyQrCodeCore 的方法封装。 */
export async function decodeWithLegacyQrCodeCore(input: QRCodeReaderInput) {
  const reader = createLegacyQrCodeReader()
  const result = await reader.decode(input)
  return normalizeQrCodeReaderResult(result)
}
