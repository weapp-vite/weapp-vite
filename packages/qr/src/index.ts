/**
 * @file 二维码工具包对外导出入口。
 */
export { decodeQrCodeFromBase64 } from './decode'
export { createQrCodeMatrix } from './encode'
export { renderTerminalQrCode } from './render'
export type { QRCodeMatrix, QRCodeRenderOptions } from './types'
