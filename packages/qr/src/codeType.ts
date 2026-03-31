/**
 * @file 二维码类型检测封装。
 */
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { decodeQrCodeFromBuffer } from './decode'
import { detectMiniProgramCodeFromBuffer } from './miniProgramCode'

/** QRCodeType 的类型定义。 */
export type QRCodeType = 'qr' | 'mini-program-code' | 'unknown'

async function detectCodeTypeBuffer(buffer: Buffer) {
  try {
    await decodeQrCodeFromBuffer(buffer)
    return 'qr' as const
  }
  catch {
    try {
      const detected = await detectMiniProgramCodeFromBuffer(buffer)
      return detected ? 'mini-program-code' as const : 'unknown' as const
    }
    catch {
      return 'unknown' as const
    }
  }
}

/** detectCodeTypeFromBuffer 的方法封装。 */
export async function detectCodeTypeFromBuffer(buffer: Buffer) {
  return await detectCodeTypeBuffer(buffer)
}

/** detectCodeTypeFromBase64 的方法封装。 */
export async function detectCodeTypeFromBase64(content: string) {
  return await detectCodeTypeFromBuffer(Buffer.from(content, 'base64'))
}

/** detectCodeTypeFromFile 的方法封装。 */
export async function detectCodeTypeFromFile(filePath: string) {
  const buffer = await readFile(filePath)
  return await detectCodeTypeFromBuffer(buffer)
}
