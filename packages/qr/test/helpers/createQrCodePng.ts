/**
 * @file 二维码 PNG 测试辅助方法。
 */
import type { QRCodeMatrix } from '../../src/types'
import { Buffer } from 'node:buffer'
import sharp from 'sharp'

/** encodeQrCodeMatrixToPngBuffer 的方法封装。 */
export async function encodeQrCodeMatrixToPngBuffer(matrix: QRCodeMatrix) {
  const scale = 8
  const border = 4
  const moduleCount = matrix.length
  const imageSize = (moduleCount + border * 2) * scale
  const pixels = Buffer.alloc(imageSize * imageSize, 255)

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!matrix[row][col]) {
        continue
      }

      const startY = (row + border) * scale
      const startX = (col + border) * scale

      for (let offsetY = 0; offsetY < scale; offsetY += 1) {
        for (let offsetX = 0; offsetX < scale; offsetX += 1) {
          const y = startY + offsetY
          const x = startX + offsetX
          pixels[y * imageSize + x] = 0
        }
      }
    }
  }

  return await sharp(pixels, {
    raw: {
      width: imageSize,
      height: imageSize,
      channels: 1,
    },
  }).png().toBuffer()
}

/** encodeQrCodeMatrixToBase64 的方法封装。 */
export async function encodeQrCodeMatrixToBase64(matrix: QRCodeMatrix) {
  const buffer = await encodeQrCodeMatrixToPngBuffer(matrix)
  return buffer.toString('base64')
}
