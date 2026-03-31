/**
 * @file 二维码解码单元测试。
 */
import { describe, expect, it } from 'vitest'
import { decodeQrCodeFromBase64 } from '../../src/decode'
import { createQrCodeMatrix } from '../../src/encode'
import { encodeQrCodeMatrixToBase64 } from '../helpers/createQrCodePng'

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
})
