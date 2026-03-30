/**
 * @file 基于 sharp 的二维码解析封装。
 */
import { Buffer } from 'node:buffer'
import sharp from 'sharp'
import QrCodeReader from './qrcode-reader/index'

interface QRCodeReaderInstance {
  callback: (error: Error | null, value: {
    result: string
  }) => void
  decode: (input: {
    width: number
    height: number
    data: Buffer
  }) => void
}
type QRCodeReaderConstructor = new () => QRCodeReaderInstance
export async function decodeQrCodeFromBase64(content: string) {
  const buffer = Buffer.from(content, 'base64')
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const Reader = QrCodeReader as unknown as QRCodeReaderConstructor
  return await new Promise<string>((resolve, reject) => {
    const reader = new Reader()
    reader.callback = (error: Error | null, value: {
      result: string
    }) => {
      if (error) {
        reject(error)
        return
      }
      resolve(value.result)
    }
    reader.decode({
      width: info.width,
      height: info.height,
      data,
    })
  })
}
