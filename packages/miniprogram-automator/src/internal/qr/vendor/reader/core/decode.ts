/**
 * @file 二维码核心 reader 纯函数解码入口。
 */
import LegacyQrCodeReader from './qrcode'
import type { QRCodeReaderConstructor, QRCodeReaderInput, QRCodeReaderResult } from './types'

/** decodeWithLegacyQrCodeCore 的方法封装。 */
export async function decodeWithLegacyQrCodeCore(input: QRCodeReaderInput) {
  const Reader = LegacyQrCodeReader as unknown as QRCodeReaderConstructor
  const reader = new Reader()

  return await new Promise<QRCodeReaderResult>((resolve, reject) => {
    reader.callback = (error, value) => {
      if (error) {
        reject(error)
        return
      }

      resolve(value)
    }

    reader.decode(input)
  })
}
