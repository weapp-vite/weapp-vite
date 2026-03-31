/**
 * @file 二维码解码单元测试。
 */
import { describe, expect, it } from 'vitest'
import { decodeQrCodeFromBase64 } from '../../src/decode'
import { createQrCodeMatrix } from '../../src/encode'
import { encodeQrCodeMatrixToBase64 } from '../helpers/createQrCodePng'
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

  it('decodes every supported real-world fixture from disk', async () => {
    const fixtures = await loadQrFixtures()

    for (const fixture of fixtures) {
      expect(fixture.content).toBeTruthy()

      const base64 = await loadQrFixtureBase64(fixture.file)
      await expect(decodeQrCodeFromBase64(base64)).resolves.toBe(fixture.content)
    }
  })

  it('fails with a stable error for unsupported real materials and mini program codes', async () => {
    const manifests = await Promise.all([
      loadFixtureManifest('materials/manifest.json'),
      loadFixtureManifest('小程序码/manifest.json'),
    ])

    for (const fixture of manifests.flat()) {
      expect(fixture.expectedError).toBeTruthy()

      const base64 = await loadQrFixtureBase64(fixture.file)
      await expect(decodeQrCodeFromBase64(base64)).rejects.toThrow(fixture.expectedError)
    }
  })
})
