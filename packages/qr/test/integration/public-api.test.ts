/**
 * @file 二维码公共 API 集成测试。
 */
import { Buffer } from 'node:buffer'
import { writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import {
  createQrCodeMatrix,
  decodeQrCodeFromBase64,
  decodeQrCodeFromBuffer,
  decodeQrCodeFromFile,
  decodeWithQrReader,
  detectCodeTypeFromBase64,
  detectCodeTypeFromBuffer,
  detectCodeTypeFromFile,
  detectMiniProgramCodeFromBase64,
  renderTerminalQrCode,
  renderTerminalQrCodeFromMatrix,
} from '../../src/index'
import { encodeQrCodeMatrixToBase64, encodeQrCodeMatrixToPngBuffer } from '../helpers/createQrCodePng'
import { loadFixtureManifest, loadQrFixtureBase64, loadQrFixtures } from '../helpers/loadFixture'

describe('@weapp-vite/qr public api', () => {
  it('supports an encode -> png -> decode roundtrip through the public entry', async () => {
    const content = 'weapp-vite qr integration'
    const matrix = createQrCodeMatrix(content)
    const base64 = await encodeQrCodeMatrixToBase64(matrix)

    await expect(decodeQrCodeFromBase64(base64)).resolves.toBe(content)
  })

  it('supports decoding qr content from buffer and file path through the public entry', async () => {
    const content = 'weapp-vite qr file and buffer integration'
    const matrix = createQrCodeMatrix(content)
    const buffer = await encodeQrCodeMatrixToPngBuffer(matrix)
    const filePath = path.join(os.tmpdir(), `weapp-vite-qr-public-${Date.now()}.png`)

    await writeFile(filePath, buffer)

    await expect(decodeQrCodeFromBuffer(buffer)).resolves.toBe(content)
    await expect(decodeQrCodeFromFile(filePath)).resolves.toBe(content)
    await expect(detectCodeTypeFromBuffer(buffer)).resolves.toBe('qr')
    await expect(detectCodeTypeFromFile(filePath)).resolves.toBe('qr')
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

  it('supports rendering a precomputed matrix through the public entry', () => {
    const content = 'render matrix integration'
    const matrix = createQrCodeMatrix(content)
    const fromMatrix = renderTerminalQrCodeFromMatrix(matrix, { small: true })
    const fromInput = renderTerminalQrCode(content, { small: true })

    expect(fromMatrix).toBe(fromInput)
  })

  it('supports decoding raw reader input through the public entry', async () => {
    const content = 'reader integration'
    const matrix = createQrCodeMatrix(content)
    const pngBuffer = await encodeQrCodeMatrixToPngBuffer(matrix)
    const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

    await expect(decodeWithQrReader({
      width: info.width,
      height: info.height,
      data,
    })).resolves.toMatchObject({ result: content })
  })

  it('rejects unsupported mini program code raw input through the public entry', async () => {
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

  it('detects mini program code structure through the public entry', async () => {
    const fixtures = await loadFixtureManifest('mini-program-codes/manifest.json')

    for (const fixture of fixtures) {
      const base64 = await loadQrFixtureBase64(fixture.file)

      await expect(detectMiniProgramCodeFromBase64(base64)).resolves.toMatchObject({
        kind: fixture.expectedDetectionKind,
      })
      await expect(detectCodeTypeFromBase64(base64)).resolves.toBe('mini-program-code')
    }
  })

  it('keeps mini program fixtures on the expected capability boundary', async () => {
    const fixtures = await loadFixtureManifest('mini-program-codes/manifest.json')

    for (const fixture of fixtures) {
      const base64 = await loadQrFixtureBase64(fixture.file)

      await expect(decodeQrCodeFromBase64(base64)).rejects.toThrow(fixture.expectedError)
      await expect(detectMiniProgramCodeFromBase64(base64)).resolves.toMatchObject({
        kind: fixture.expectedDetectionKind,
      })
      await expect(detectCodeTypeFromBase64(base64)).resolves.toBe('mini-program-code')
    }
  })
})
