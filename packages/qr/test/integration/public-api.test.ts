/**
 * @file 二维码公共 API 集成测试。
 */
import { describe, expect, it } from 'vitest'
import { createQrCodeMatrix, decodeQrCodeFromBase64, renderTerminalQrCode } from '../../src/index'
import { encodeQrCodeMatrixToBase64 } from '../helpers/createQrCodePng'
import { loadQrFixtureBase64, loadQrFixtures } from '../helpers/loadFixture'

describe('@weapp-vite/qr public api', () => {
  it('supports an encode -> png -> decode roundtrip through the public entry', async () => {
    const content = 'weapp-vite qr integration'
    const matrix = createQrCodeMatrix(content)
    const base64 = await encodeQrCodeMatrixToBase64(matrix)

    await expect(decodeQrCodeFromBase64(base64)).resolves.toBe(content)
  })

  it('decodes real fixture files from disk through the public entry', async () => {
    const fixtures = await loadQrFixtures()

    for (const fixture of fixtures) {
      const base64 = await loadQrFixtureBase64(fixture.file)
      await expect(decodeQrCodeFromBase64(base64)).resolves.toBe(fixture.content)
    }
  })

  it('supports rendering the same content in compact and full terminal modes', () => {
    const content = 'render integration'
    const compact = renderTerminalQrCode(content, { small: true })
    const full = renderTerminalQrCode(content)

    expect(compact).toContain('▀')
    expect(full).toContain('\u001B[40m')
    expect(full).not.toEqual(compact)
  })
})
