/**
 * @file 二维码工具包对外导出入口。
 */
export { decodeQrCodeFromBase64, decodeQrCodeFromBuffer, decodeQrCodeFromFile } from './decode'
export { createQrCodeMatrix } from './encode'
export {
  detectMiniProgramCodeFromBase64,
  detectMiniProgramCodeFromBuffer,
  detectMiniProgramCodeFromFile,
} from './miniProgramCode'
export type { MiniProgramCodeDetectionResult } from './miniProgramCode'
export { decodeWithQrReader } from './reader/decode'
export type {
  QRCodeReaderCallback,
  QRCodeReaderConstructor,
  QRCodeReaderInput,
  QRCodeReaderInstance,
  QRCodeReaderResult,
} from './reader/types'
export { renderTerminalQrCode, renderTerminalQrCodeFromMatrix } from './render'
export type { QRCodeMatrix, QRCodeRenderOptions } from './types'
