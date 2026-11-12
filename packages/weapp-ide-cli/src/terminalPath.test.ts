import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatTerminalPath } from './terminalPath'

vi.mock('./logger', () => ({ colors: { green: (value: string) => value } }))

describe('terminal diagnostic paths', () => {
  let stderrIsTTY: PropertyDescriptor | undefined
  let stdoutIsTTY: PropertyDescriptor | undefined

  beforeEach(() => {
    stderrIsTTY = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY')
    stdoutIsTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY')
    Object.defineProperty(process.stderr, 'isTTY', { configurable: true, value: true })
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: false })
    vi.stubEnv('CI', '')
    vi.stubEnv('TERM', 'xterm-256color')
  })

  afterEach(() => {
    for (const [stream, descriptor] of [[process.stderr, stderrIsTTY], [process.stdout, stdoutIsTTY]] as const) {
      if (descriptor) {
        Object.defineProperty(stream, 'isTTY', descriptor)
      }
      else {
        Reflect.deleteProperty(stream, 'isTTY')
      }
    }
    vi.unstubAllEnvs()
  })

  it('keeps the original label and encodes the hidden absolute file target', () => {
    const input = path.join('fixtures', '微信 tools #%?', 'cli')
    const result = formatTerminalPath(input)
    const [opening, label, tail] = result.split('\u001B\\')
    expect(opening?.startsWith('\u001B]8;;file://')).toBe(true)
    const target = opening!.slice('\u001B]8;;'.length)
    expect(target).toContain('%20')
    expect(target).toContain('%23')
    expect(target).toContain('%25')
    expect(target).toContain('%3F')
    expect(target).not.toContain('微信')
    expect(fileURLToPath(target)).toBe(path.resolve(input))
    expect(label).toBe(`${input}\u001B]8;;`)
    expect(tail).toBe('')
  })

  it('uses stderr terminal status even when stdout is redirected', () => {
    const input = path.resolve('fixtures', 'config.json')
    const target = formatTerminalPath(input).split('\u001B\\')[0]!.slice('\u001B]8;;'.length)
    expect(fileURLToPath(target)).toBe(input)
  })

  it('keeps redirected diagnostics as raw paths even when stdout is a terminal', () => {
    Object.defineProperty(process.stderr, 'isTTY', { configurable: true, value: false })
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true })
    const input = path.join('fixtures', 'config.json')
    expect(formatTerminalPath(input)).toBe(input)
  })

  it.each([['CI', 'true'], ['TERM', 'dumb']])('keeps raw paths with %s=%s', (key, value) => {
    vi.stubEnv(key, value)
    const input = path.join('fixtures', 'config.json')
    expect(formatTerminalPath(input)).toBe(input)
  })
})
