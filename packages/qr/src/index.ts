/**
 * @file 二维码工具包对外导出入口。
 */
export { detectCodeTypeFromBase64, detectCodeTypeFromBuffer, detectCodeTypeFromFile } from './codeType'
export type { QRCodeType } from './codeType'
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
  QRCodeReaderConstructor,
  QRCodeReaderInput,
  QRCodeReaderInstance,
  QRCodeReaderResult,
} from './reader/types'
export { renderTerminalQrCode, renderTerminalQrCodeFromMatrix } from './render'
export type { QRCodeMatrix, QRCodeRenderOptions } from './types'
