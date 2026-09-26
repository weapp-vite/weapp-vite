import { describe, expect, it } from 'vitest'
import { createBenchmarkPath } from '../scripts/utils/benchmarkTarget'

describe('benchmark process PATH', () => {
  it('preserves Windows drive letters and spaces with the native separator', () => {
    expect(createBenchmarkPath('C:/sample project/node_modules/.bin', 'C:/tools;D:/node', 'win32'))
      .toBe('C:/sample project/node_modules/.bin;C:/tools;D:/node')
  })
  it('uses colon on Unix and preserves an empty inherited PATH', () => {
    expect(createBenchmarkPath('/sample/bin', '/usr/bin:/bin', 'linux')).toBe('/sample/bin:/usr/bin:/bin')
    expect(createBenchmarkPath('/sample/bin', '', 'darwin')).toBe('/sample/bin:')
  })
})
