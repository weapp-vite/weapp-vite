/**
 * @file 二维码 reader vendor 纯函数解码入口。
 */
import { decodeWithLegacyQrCodeCore } from './core/decode'
import type { QRCodeReaderInput } from './types'

/** decodeWithVendorQrReader 的方法封装。 */
export async function decodeWithVendorQrReader(input: QRCodeReaderInput) {
  return await decodeWithLegacyQrCodeCore(input)
}
