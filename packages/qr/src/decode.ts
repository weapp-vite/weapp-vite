/**
 * @file 基于 sharp 的二维码解码封装。
 */
import { Buffer } from 'node:buffer'
import sharp from 'sharp'
import { decodeWithQrReader } from './reader/decode'

async function decodeQrCodeBuffer(buffer: Buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const result = await decodeWithQrReader({
    width: info.width,
    height: info.height,
    data,
  })

  return result.result
}

/** decodeQrCodeFromBase64 的方法封装。 */
export async function decodeQrCodeFromBase64(content: string) {
  return await decodeQrCodeBuffer(Buffer.from(content, 'base64'))
}
