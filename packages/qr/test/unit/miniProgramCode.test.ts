/**
 * @file 小程序码结构识别单元测试。
 */
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  detectMiniProgramCodeFromBase64,
  detectMiniProgramCodeFromBuffer,
  detectMiniProgramCodeFromFile,
} from '../../src/miniProgramCode'
import { loadFixtureManifest, loadQrFixtureBase64 } from '../helpers/loadFixture'

describe('mini program code detection', () => {
  it('detects imported mini program code fixtures from files', async () => {
    const fixtures = await loadFixtureManifest('mini-program-codes/manifest.json')
    const imported = fixtures.filter(fixture => fixture.file.includes('/imported/'))

    for (const fixture of imported) {
      const result = await detectMiniProgramCodeFromFile(path.resolve(import.meta.dirname, '../fixtures', fixture.file))

      expect(result?.kind).toBe(fixture.expectedDetectionKind)
      expect(result?.locatorPoints).toHaveLength(3)
      expect(result?.badgeBounds).toBeTruthy()
      expect(result?.confidence ?? 0).toBeGreaterThanOrEqual(fixture.expectedMinConfidence ?? 0)
    }
  })

  it('detects official mini program code fixtures from buffers', async () => {
    const fixtures = await loadFixtureManifest('mini-program-codes/manifest.json')
    const official = fixtures.filter(fixture => fixture.file.includes('/official/'))

    for (const fixture of official) {
      const base64 = await loadQrFixtureBase64(fixture.file)
      const result = await detectMiniProgramCodeFromBuffer(Buffer.from(base64, 'base64'))

      expect(result?.kind).toBe(fixture.expectedDetectionKind)
      expect(result?.locatorPoints).toHaveLength(3)
      expect(result?.badgeBounds).toBeTruthy()
      expect(result?.confidence ?? 0).toBeGreaterThanOrEqual(fixture.expectedMinConfidence ?? 0)
    }
  })

  it('detects mini program code fixtures from base64', async () => {
    const fixture = (await loadFixtureManifest('mini-program-codes/manifest.json'))[0]
    const base64 = await loadQrFixtureBase64(fixture.file)
    const result = await detectMiniProgramCodeFromBase64(base64)

    expect(result?.kind).toBe(fixture.expectedDetectionKind)
    expect(result?.locatorPoints).toHaveLength(3)
    expect(result?.badgeBounds).toBeTruthy()
    expect(result?.confidence ?? 0).toBeGreaterThanOrEqual(fixture.expectedMinConfidence ?? 0)
  })

  it('does not misclassify a normal qr fixture as a mini program code', async () => {
    const base64 = await loadQrFixtureBase64('basic.png')

    await expect(detectMiniProgramCodeFromBase64(base64)).resolves.toBeNull()
  })
})
