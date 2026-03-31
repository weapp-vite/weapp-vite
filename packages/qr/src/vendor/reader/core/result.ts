/**
 * @file 二维码核心 reader 结果归一化。
 */
import type { QRCodeReaderResult } from './types'

/** normalizeQrCodeReaderResult 的方法封装。 */
export function normalizeQrCodeReaderResult(value: unknown): QRCodeReaderResult {
  if (
    value
    && typeof value === 'object'
    && 'result' in value
    && typeof (value as { result: unknown }).result === 'string'
  ) {
    return value as QRCodeReaderResult
  }

  throw new TypeError('Invalid QR code reader result')
}
