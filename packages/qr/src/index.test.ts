/**
 * @file 二维码工具包测试。
 */
import { Buffer } from 'node:buffer'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { createQrCodeMatrix, decodeQrCodeFromBase64, renderTerminalQrCode } from './index'

async function createQrCodeBase64(content: string) {
  const qrcode = createQrCodeMatrix(content)

  const scale = 8
  const border = 4
  const moduleCount = qrcode.length
  const imageSize = (moduleCount + border * 2) * scale
  const pixels = Buffer.alloc(imageSize * imageSize, 255)

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!qrcode[row][col]) {
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

describe('@weapp-vite/qr', () => {
  it('creates qr code matrices for rendering and tests', () => {
    expect(createQrCodeMatrix('Test').length).toBeGreaterThan(0)
  })

  it('decodes qr code content from base64 png with sharp', async () => {
    const fixture = await createQrCodeBase64('Test')
    await expect(decodeQrCodeFromBase64(fixture.toString('base64'))).resolves.toBe('Test')
  })

  it('renders small terminal qr codes without the external dependency', () => {
    expect(renderTerminalQrCode('Test', { small: true })).toContain('▀')
  })
})
