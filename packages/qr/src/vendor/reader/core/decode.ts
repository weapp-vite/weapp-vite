/**
 * @file 二维码核心 reader 纯函数解码入口。
 */
import type { QRCodeReaderConstructor, QRCodeReaderInput, QRCodeReaderResult } from './types'
import { normalizeQrCodeReaderResult } from './result'
import { createLegacyQrCodeReader } from './runtime'

/** decodeWithLegacyQrCodeCore 的方法封装。 */
export async function decodeWithLegacyQrCodeCore(input: QRCodeReaderInput) {
  return await new Promise<QRCodeReaderResult>((resolve, reject) => {
    const reader = createLegacyQrCodeReader()
    reader.callback = (error, value) => {
      if (error) {
        reject(error)
        return
      }

      resolve(normalizeQrCodeReaderResult(value))
    }

    reader.decode(input)
  })
}
