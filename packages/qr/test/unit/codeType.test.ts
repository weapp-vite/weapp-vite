/**
 * @file 二维码类型检测单元测试。
 */
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectCodeTypeFromBase64, detectCodeTypeFromBuffer, detectCodeTypeFromFile } from '../../src/codeType'
import { createQrCodeMatrix } from '../../src/encode'
import { encodeQrCodeMatrixToBase64, encodeQrCodeMatrixToPngBuffer } from '../helpers/createQrCodePng'
import { loadFixtureManifest, loadQrFixtureBase64 } from '../helpers/loadFixture'

describe('code type detection', () => {
  it('detects a standard qr code from base64', async () => {
    const matrix = createQrCodeMatrix('type detector')
    const base64 = await encodeQrCodeMatrixToBase64(matrix)

    await expect(detectCodeTypeFromBase64(base64)).resolves.toBe('qr')
  })

  it('detects a standard qr code from buffer', async () => {
    const matrix = createQrCodeMatrix('buffer type detector')
    const buffer = await encodeQrCodeMatrixToPngBuffer(matrix)

    await expect(detectCodeTypeFromBuffer(buffer)).resolves.toBe('qr')
  })

  it('detects mini program codes from file paths', async () => {
    const fixture = (await loadFixtureManifest('mini-program-codes/manifest.json'))[0]

    await expect(detectCodeTypeFromFile(
      path.resolve(import.meta.dirname, '../fixtures', fixture.file),
    )).resolves.toBe('mini-program-code')
  })

  it('detects mini program codes from base64', async () => {
    const fixture = (await loadFixtureManifest('mini-program-codes/manifest.json'))[0]
    const base64 = await loadQrFixtureBase64(fixture.file)

    await expect(detectCodeTypeFromBase64(base64)).resolves.toBe('mini-program-code')
  })

  it('returns unknown for non-qr image buffers', async () => {
    await expect(detectCodeTypeFromBuffer(Buffer.from('not-an-image'))).resolves.toBe('unknown')
  })
})
