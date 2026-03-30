/**
 * @file 工具函数测试。
 */
import { Buffer } from 'node:buffer'
import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'
import QRCode from './internal/qrcode-terminal/QRCode/index'
import QRErrorCorrectLevel from './internal/qrcode-terminal/QRCode/QRErrorCorrectLevel'
import { decodeQrCode, extractPluginId, isPluginPath, printQrCode } from './util'

async function createQrCodeBase64(content: string) {
  const qrcode = new (QRCode as unknown as new (typeNumber: number, errorCorrectLevel: number) => {
    addData: (input: string) => void
    getModuleCount: () => number
    make: () => void
    modules: boolean[][]
  })(-1, (QRErrorCorrectLevel as Record<string, number>).L)
  qrcode.addData(content)
  qrcode.make()

  const scale = 8
  const border = 4
  const moduleCount = qrcode.getModuleCount()
  const imageSize = (moduleCount + border * 2) * scale
  const pixels = Buffer.alloc(imageSize * imageSize, 255)

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!qrcode.modules[row][col]) {
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

describe('util helpers', () => {
  it('keeps plugin path helpers compatible', () => {
    expect(isPluginPath('plugin-private://abc/pages/index')).toBe(true)
    expect(extractPluginId('plugin-private://abc/pages/index')).toBe('abc')
    expect(extractPluginId('/pages/index/index')).toBe('')
  })

  it('decodes qr code content from base64 png with sharp', async () => {
    const fixture = await createQrCodeBase64('Test')
    await expect(decodeQrCode(fixture.toString('base64'))).resolves.toBe('Test')
  })

  it('renders small terminal qr codes without the external dependency', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    await printQrCode('Test')
    expect(write).toHaveBeenCalledTimes(1)
    expect(String(write.mock.calls[0]?.[0] ?? '')).toContain('▀')
    write.mockRestore()
  })
})
