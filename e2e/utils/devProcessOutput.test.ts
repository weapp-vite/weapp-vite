import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { createDevProcessOutput } from './devProcessOutput'

function capture() {
  const chunks: string[] = []
  const output = createDevProcessOutput(text => chunks.push(text))
  return { output, read: () => chunks.join('') }
}

describe('dev process output stream framing', () => {
  it('keeps a large stdout JSON line continuous across interleaved stderr and append-only cursors', () => {
    const { output, read } = capture()
    const receipt = { boundary: 'native-byte-write', payload: 'x'.repeat(220_000) }
    const line = `[native-publication] ${JSON.stringify(receipt)}\n`
    output.write('stdout', line.slice(0, 131_072))
    const cursor = read().length
    const prefix = read()
    output.write('stderr', '\u001B[33m[PLUGIN_TIMINGS] callbacks overlapped\u001B[0m\n')
    expect(read()).toBe(prefix)
    output.write('stdout', line.slice(131_072))
    expect(read().startsWith(prefix)).toBe(true)
    expect(read().slice(0, line.length)).toBe(line)
    expect(JSON.parse(read().split('\n')[0]!.slice('[native-publication] '.length))).toEqual(receipt)
    expect(read().slice(cursor)).not.toContain('[native-publication]')
    expect(read().slice(line.length)).toContain('[PLUGIN_TIMINGS]')
  })

  it('does not let an incomplete stderr status lock a complete stdout startup signal', () => {
    const { output, read } = capture()
    output.write('stderr', '[status] compiling')
    output.write('stdout', '小程序初次构建完成\n')
    expect(read()).toBe('小程序初次构建完成\n')
    output.write('stderr', ' complete\n')
    expect(read()).toBe('小程序初次构建完成\n[status] compiling complete\n')
  })

  it('decodes split UTF-8 independently on each stream and normalizes CRLF', () => {
    const { output, read } = capture()
    const message = Buffer.from('开始完成\r\n')
    output.write('stdout', message.subarray(0, 5))
    output.write('stderr', Buffer.from('[warn] 独立流\r\n'))
    output.write('stdout', message.subarray(5))
    expect(read()).toBe('开始完成\n[warn] 独立流\n')
    expect(read()).not.toContain('\uFFFD')
  })

  it('releases an unterminated stream tail at EOF without merging the next stream', () => {
    const { output, read } = capture()
    output.write('stdout', 'unterminated')
    output.write('stderr', '[error] still observable\n')
    output.end('stdout')
    expect(read()).toBe('unterminated\n[error] still observable\n')
    output.flush()
    output.flush()
    expect(read()).toBe('unterminated\n[error] still observable\n')
  })

  it('flushes both unfinished tails once while preserving a lone tail verbatim', () => {
    const { output, read } = capture()
    output.write('stdout', 'stdout')
    output.write('stderr', 'stderr')
    output.flush()
    output.flush()
    expect(read()).toBe('stdout\nstderr')
    const single = capture()
    single.output.write('stdout', 'single tail')
    single.output.flush()
    expect(single.read()).toBe('single tail')
  })

  it.each(['compiling\r', '\rcompiling'])('releases a CR spinner before stdout readiness: %j', (spinner) => {
    const { output, read } = capture()
    output.write('stderr', spinner)
    output.write('stdout', '小程序初次构建完成\n')
    expect(read()).toContain('小程序初次构建完成\n')
    output.flush()
    expect(read()).toContain('compiling')
  })

  it('normalizes CRLF split across chunks without adding a second line after another stream', () => {
    const { output, read } = capture()
    output.write('stderr', 'spinner\r')
    output.write('stdout', 'ready\r')
    const cursor = read().length
    output.write('stderr', '\n')
    output.write('stdout', '\nnext\r')
    output.write('stdout', '\n')
    expect(read()).toBe('spinner\nready\nnext\n')
    expect(read().slice(cursor)).toBe('next\n')
  })

  it('keeps late output framed across streams after an earlier EOF flush', () => {
    const { output, read } = capture()
    output.write('stdout', 'initial\n')
    output.flush()
    output.write('stdout', '[native-publication] {"late":')
    output.write('stderr', '[error] late stderr\n')
    output.write('stdout', 'true}\n')
    output.flush()
    output.flush()
    expect(read()).toBe('initial\n[native-publication] {"late":true}\n[error] late stderr\n')
  })
})
