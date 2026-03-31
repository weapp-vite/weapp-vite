/**
 * @file 二维码解码单元测试。
 */
import { Buffer } from 'node:buffer'
import { writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { decodeQrCodeFromBase64, decodeQrCodeFromBuffer, decodeQrCodeFromFile } from '../../src/decode'
import { createQrCodeMatrix } from '../../src/encode'
import { decodeWithQrReader } from '../../src/reader/decode'
import { encodeQrCodeMatrixToBase64, encodeQrCodeMatrixToPngBuffer } from '../helpers/createQrCodePng'
import { loadFixtureManifest, loadQrFixtureBase64, loadQrFixtures } from '../helpers/loadFixture'

describe('decodeQrCodeFromBase64', () => {
  it('decodes a generated qr code png encoded as base64', async () => {
    const matrix = createQrCodeMatrix('Test')
    const base64 = await encodeQrCodeMatrixToBase64(matrix)

    await expect(decodeQrCodeFromBase64(base64)).resolves.toBe('Test')
  })

  it('keeps url-like payloads intact after decoding', async () => {
    const content = 'https://vite.icebreaker.top/?from=qr&lang=zh-CN'
    const matrix = createQrCodeMatrix(content)
    const base64 = await encodeQrCodeMatrixToBase64(matrix)

    await expect(decodeQrCodeFromBase64(base64)).resolves.toBe(content)
  })

  it('decodes a generated qr code from a png buffer', async () => {
    const content = 'buffer decode'
    const matrix = createQrCodeMatrix(content)
    const buffer = await encodeQrCodeMatrixToPngBuffer(matrix)

    await expect(decodeQrCodeFromBuffer(buffer)).resolves.toBe(content)
  })

  it('decodes a generated qr code from a file path', async () => {
    const content = 'file decode'
    const matrix = createQrCodeMatrix(content)
    const buffer = await encodeQrCodeMatrixToPngBuffer(matrix)
    const filePath = path.join(os.tmpdir(), `weapp-vite-qr-${Date.now()}.png`)

    await writeFile(filePath, buffer)

    await expect(decodeQrCodeFromFile(filePath)).resolves.toBe(content)
  })

  it('rejects an invalid image buffer', async () => {
    await expect(decodeQrCodeFromBuffer(Buffer.from('not-an-image'))).rejects.toThrow()
  })

  it('rejects a missing file path', async () => {
    const filePath = path.join(os.tmpdir(), `weapp-vite-qr-missing-${Date.now()}.png`)

    await expect(decodeQrCodeFromFile(filePath)).rejects.toThrow(/ENOENT/u)
  })

  it('decodes every supported real-world fixture from disk', async () => {
    const fixtures = await loadQrFixtures()

    for (const fixture of fixtures) {
      expect(fixture.content).toBeTruthy()

      const base64 = await loadQrFixtureBase64(fixture.file)
      await expect(decodeQrCodeFromBase64(base64)).resolves.toBe(fixture.content)
    }
  })

  it('fails with a stable error for current mini program code fixtures', async () => {
    const fixtures = await loadFixtureManifest('mini-program-codes/manifest.json')

    for (const fixture of fixtures) {
      expect(fixture.expectedError).toBeTruthy()

      const base64 = await loadQrFixtureBase64(fixture.file)
      await expect(decodeQrCodeFromBase64(base64)).rejects.toThrow(fixture.expectedError)
    }
  })

  it('keeps the exported buffer decoder aligned with the base64 decoder', async () => {
    const fixture = (await loadQrFixtures())[0]
    const base64 = await loadQrFixtureBase64(fixture.file)
    const buffer = Buffer.from(base64, 'base64')

    await expect(decodeQrCodeFromBase64(base64)).resolves.toBe(fixture.content)
    await expect(decodeQrCodeFromBuffer(buffer)).resolves.toBe(fixture.content)
  })
})

describe('decodeWithQrReader', () => {
  it('decodes generated raw rgba image data', async () => {
    const content = 'reader unit'
    const matrix = createQrCodeMatrix(content)
    const pngBuffer = await encodeQrCodeMatrixToPngBuffer(matrix)
    const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

    await expect(decodeWithQrReader({
      width: info.width,
      height: info.height,
      data,
    })).resolves.toMatchObject({ result: content })
  })

  it('rejects unsupported mini program code fixture input', async () => {
    const fixture = (await loadFixtureManifest('mini-program-codes/manifest.json'))[0]
    const base64 = await loadQrFixtureBase64(fixture.file)
    const { data, info } = await sharp(Buffer.from(base64, 'base64'))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    await expect(decodeWithQrReader({
      width: info.width,
      height: info.height,
      data,
    })).rejects.toThrow(fixture.expectedError)
  })
})
