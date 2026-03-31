/**
 * @file 二维码渲染单元测试。
 */
import { describe, expect, it } from 'vitest'
import { createQrCodeMatrix } from '../../src/encode'
import { renderTerminalQrCode, renderTerminalQrCodeFromMatrix } from '../../src/render'

describe('renderTerminalQrCode', () => {
  it('renders compact qr code output with block characters', () => {
    const output = renderTerminalQrCode('Test', { small: true })

    expect(output).toContain('▀')
    expect(output).not.toContain('\u001B[')
    expect(output.split('\n').length).toBeGreaterThan(1)
  })

  it('renders full qr code output with ansi background colors', () => {
    const output = renderTerminalQrCode('Test')

    expect(output).toContain('\u001B[40m')
    expect(output).toContain('\u001B[47m')
  })

  it('renders different payloads into different terminal output', () => {
    const first = renderTerminalQrCode('alpha', { small: true })
    const second = renderTerminalQrCode('beta', { small: true })

    expect(second).not.toEqual(first)
  })

  it('renders an existing matrix without re-encoding the content', () => {
    const matrix = createQrCodeMatrix('matrix render')
    const fromMatrix = renderTerminalQrCodeFromMatrix(matrix, { small: true })
    const fromInput = renderTerminalQrCode('matrix render', { small: true })

    expect(fromMatrix).toBe(fromInput)
  })
})
