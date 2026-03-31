import type { QRCodeReaderInput } from './types'
/**
 * @file 二维码 reader 纯函数解码入口。
 */
import { decodeWithLegacyQrCodeCore } from './core/decode'

/** decodeWithQrReader 的方法封装。 */
export async function decodeWithQrReader(input: QRCodeReaderInput) {
  return await decodeWithLegacyQrCodeCore(input)
}
