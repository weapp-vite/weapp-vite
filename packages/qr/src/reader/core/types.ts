/**
 * @file 二维码核心 reader 类型定义。
 */
import type { Buffer } from 'node:buffer'

/** QRCodeReaderResult 的类型定义。 */
export interface QRCodeReaderResult {
  result: string
}

/** QRCodeReaderInput 的类型定义。 */
export interface QRCodeReaderInput {
  width: number
  height: number
  data: Buffer
}

/** QRCodeReaderInstance 的类型定义。 */
export interface QRCodeReaderInstance {
  decode: (input: QRCodeReaderInput) => Promise<QRCodeReaderResult>
}

/** QRCodeReaderConstructor 的类型定义。 */
export type QRCodeReaderConstructor = new () => QRCodeReaderInstance
