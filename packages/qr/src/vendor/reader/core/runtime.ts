/**
 * @file 二维码核心 reader 运行时适配。
 */
import LegacyQrCodeReader from './qrcode'
import type { QRCodeReaderConstructor, QRCodeReaderInstance } from './types'

/** createLegacyQrCodeReader 的方法封装。 */
export function createLegacyQrCodeReader(): QRCodeReaderInstance {
  const Reader = LegacyQrCodeReader as unknown as QRCodeReaderConstructor
  return new Reader()
}
