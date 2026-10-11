import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { sameManagedProcess } from '../../host'
import { cimStartedFromTicks, parseWindowsSelfIdentity, SELF_IDENTITY_WIRE } from './wire'

// 此处绝对路径用于覆盖 Windows 编码与身份精确比较，不依赖本机安装目录。
const executable = String.raw`C:\Program Files\中文工具 🧪\node.exe`
const ticks = '639269962527968118'
const started = '2026-10-07T18:57:32.7968110Z'
const fields = [SELF_IDENTITY_WIRE, 'present', '321', ticks, ticks, 'false', started, Buffer.from(executable).toString('base64')]
const wire = (...values: string[]) => `${values.join('\t')}\r\n`

describe('Windows journal self identity wire', () => {
  it('preserves Unicode and spaces with exactly the legacy CIM identity in both comparison directions', () => {
    const current = parseWindowsSelfIdentity(wire(...fields), 321)
    const legacy = { pid: 321, executable, started }
    expect(current).toEqual(legacy)
    expect(sameManagedProcess(current, legacy)).toBe(true)
    expect(sameManagedProcess(legacy, current)).toBe(true)
    expect(sameManagedProcess(current, { ...legacy, started: '2026-10-07T18:57:32.7968120Z' })).toBe(false)
    expect(sameManagedProcess(current, { ...legacy, pid: 322 })).toBe(false)
    expect(sameManagedProcess(current, { ...legacy, executable: executable.toLowerCase() })).toBe(false)
  })

  it('accepts LF without changing the identity contract', () => {
    expect(parseWindowsSelfIdentity(`${fields.join('\t')}\n`, 321).started).toBe(started)
  })

  it.each([
    [0, 'unexpected-version'],
    [1, 'missing'],
    [2, '322'],
    [3, '639269962527968119'],
    [4, '639269962527968117'],
    [5, 'true'],
    [6, '2026-10-07T18:57:32.7968118Z'],
    [6, '2026-10-07T18:57:32.796Z'],
    [7, 'not/base64!'],
    [7, Buffer.from([0xFF]).toString('base64')],
    [7, Buffer.from('path\u0000suffix').toString('base64')],
    [7, Buffer.from('   ').toString('base64')],
  ] as const)('rejects incomplete, exited, reused or malformed identity field %i', (index, value) => {
    const altered = [...fields]
    altered[index] = value
    expect(() => parseWindowsSelfIdentity(wire(...altered), 321)).toThrow()
  })

  it.each(['', '\n', 'missing', `noise\n${wire(...fields)}`, `${wire(...fields)}${wire(...fields)}`, `${wire(...fields)}\n`, wire(...fields, 'extra')])('rejects missing or extra protocol output', (stdout) => {
    expect(() => parseWindowsSelfIdentity(stdout, 321)).toThrow()
  })

  it('requires a valid expected process identity instead of accepting supplied output alone', () => {
    expect(() => parseWindowsSelfIdentity(wire(...fields), 0)).toThrow()
    expect(() => parseWindowsSelfIdentity(wire(...fields), Number.NaN)).toThrow()
  })
})

describe('CIM compatible creation time', () => {
  it.each([
    ['639269956809624056', '2026-10-07T18:48:00.9624050Z'],
    ['639269958878390886', '2026-10-07T18:51:27.8390880Z'],
    ['639269958293175637', '2026-10-07T18:50:29.3175630Z'],
    [ticks, started],
    ['621355968000000000', '1970-01-01T00:00:00.0000000Z'],
    ['621355968009999999', '1970-01-01T00:00:00.9999990Z'],
    ['621355968010000000', '1970-01-01T00:00:01.0000000Z'],
  ])('retains microseconds without rounding %s', (value, expected) => {
    expect(cimStartedFromTicks(value)).toBe(expected)
  })

  it.each(['', '-1', '1e18', '639269962527968118.0', '0639269962527968118', '621355967999999999', '3155378976000000000'])('rejects invalid or unsupported ticks %s', (value) => {
    expect(() => cimStartedFromTicks(value)).toThrow()
  })
})
