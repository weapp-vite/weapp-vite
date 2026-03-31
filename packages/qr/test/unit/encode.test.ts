/**
 * @file 二维码编码单元测试。
 */
import { describe, expect, it } from 'vitest'
import { createQrCodeMatrix } from '../../src/encode'

describe('createQrCodeMatrix', () => {
  it('creates a square boolean matrix', () => {
    const matrix = createQrCodeMatrix('Test')

    expect(matrix.length).toBeGreaterThan(0)
    expect(matrix.every(row => row.length === matrix.length)).toBe(true)
    expect(matrix.flat().every(cell => typeof cell === 'boolean')).toBe(true)
  })

  it('creates deterministic output for the same input', () => {
    const first = createQrCodeMatrix('https://vite.icebreaker.top/')
    const second = createQrCodeMatrix('https://vite.icebreaker.top/')

    expect(second).toEqual(first)
  })

  it('produces different matrices for different content', () => {
    const first = createQrCodeMatrix('alpha')
    const second = createQrCodeMatrix('beta')

    expect(second).not.toEqual(first)
  })
})
