/**
 * @file 真实二维码与小程序码素材集成测试。
 */
import { describe, expect, it } from 'vitest'
import { decodeQrCodeFromBase64 } from '../../src/index'
import { loadFixtureManifest, loadQrFixtureBase64, loadQrFixtures } from '../helpers/loadFixture'

describe('@weapp-vite/qr real-world fixtures', () => {
  it('decodes every supported real qr fixture through the public api', async () => {
    const fixtures = await loadQrFixtures()

    for (const fixture of fixtures) {
      expect(fixture.content).toBeTruthy()

      const base64 = await loadQrFixtureBase64(fixture.file)
      await expect(decodeQrCodeFromBase64(base64)).resolves.toBe(fixture.content)
    }
  })

  it('rejects current mini program code fixtures through the public api with stable errors', async () => {
    const fixtures = await loadFixtureManifest('小程序码/manifest.json')

    for (const fixture of fixtures) {
      expect(fixture.expectedError).toBeTruthy()

      const base64 = await loadQrFixtureBase64(fixture.file)
      await expect(decodeQrCodeFromBase64(base64)).rejects.toThrow(fixture.expectedError)
    }
  })
})
