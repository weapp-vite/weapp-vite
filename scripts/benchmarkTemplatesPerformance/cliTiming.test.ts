import { describe, expect, it } from 'vitest'
import { parseCliBuildMs } from './cliTiming'

describe('CLI build timing', () => {
  it.each([
    ['[success] 小程序构建完成，耗时：\u001B[32m6715ms\u001B[39m\r\n', 6715],
    ['✓ built in \u001B[32m1.25s\u001B[39m', 1250],
    ['耗时： 12.5 ms', 12.5],
    ['没有构建耗时', null],
  ])('reads the actual duration from %s', (text, expected) => {
    expect(parseCliBuildMs(text)).toBe(expected)
  })
})
