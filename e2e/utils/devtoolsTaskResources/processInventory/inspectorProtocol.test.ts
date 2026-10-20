import { Buffer } from 'node:buffer'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { inspectorLines } from './inspectorProtocol'

afterEach(() => vi.useRealTimers())

function fixture() {
  const stdout = new PassThrough()
  let finish!: () => void
  const terminal = new Promise<void>((resolve) => {
    finish = resolve
  })
  return { stdout, finish, lines: inspectorLines(stdout, terminal) }
}

describe('single request inspector line protocol', () => {
  it('accepts chunked lines and removes its listener after disposal', async () => {
    const { stdout, lines } = fixture()
    const first = lines.next(1_000)
    stdout.write('{"phase":')
    stdout.write('"ready"}\n')
    expect(await first).toBe('{"phase":"ready"}')
    const second = lines.next(1_000)
    stdout.write('{"phase":"paths","paths":[]}\n')
    expect(await second).toBe('{"phase":"paths","paths":[]}')
    lines.assertComplete()
    lines.dispose()
    expect(stdout.listenerCount('data')).toBe(0)
  })

  it('preserves a Unicode executable path split at every UTF-8 byte boundary', async () => {
    const { stdout, lines } = fixture()
    const response = lines.next(1_000)
    const payload = JSON.stringify({ phase: 'paths', paths: [{ pid: 11, executable: '/应用/微信工具😀.app/宿主' }] })
    for (const byte of Buffer.from(`${payload}\n`)) {
      stdout.write(Buffer.from([byte]))
    }
    expect(await response).toBe(payload)
    lines.assertComplete()
    lines.dispose()
  })

  it('rejects malformed or incomplete UTF-8 without accepting a corrupted path', async () => {
    const malformed = fixture()
    const response = malformed.lines.next(1_000)
    malformed.stdout.write(Buffer.from([0xC3, 0x28]))
    await expect(response).rejects.toThrow('UTF-8')
    malformed.lines.dispose()
    const incomplete = fixture()
    const pending = incomplete.lines.next(1_000)
    incomplete.stdout.write(Buffer.from([0xF0, 0x9F]))
    incomplete.finish()
    await expect(pending).rejects.toThrow('UTF-8')
    incomplete.lines.dispose()
  })

  it.each(['{}\n{}\n', '{}\npartial', 'x'.repeat(1024 * 1024 + 1)])('rejects extra or oversized output', async (output) => {
    const { stdout, lines } = fixture()
    const response = lines.next(1_000).catch(error => error)
    stdout.write(output)
    await response
    expect(() => lines.assertComplete()).toThrow()
    lines.dispose()
  })

  it('rejects idle output and incomplete output when the held child exits', async () => {
    const idle = fixture()
    idle.stdout.write('{}')
    await expect(idle.lines.next(1_000)).rejects.toThrow('unsolicited')
    idle.lines.dispose()
    const ended = fixture()
    const response = ended.lines.next(1_000)
    ended.stdout.write('{')
    ended.finish()
    await expect(response).rejects.toThrow('exited')
    ended.lines.dispose()
  })

  it('rejects an expired response and releases its timer', async () => {
    vi.useFakeTimers()
    const { lines } = fixture()
    const response = lines.next(20).catch(error => error)
    await vi.advanceTimersByTimeAsync(20)
    expect(await response).toMatchObject({ message: expect.stringContaining('budget') })
    expect(vi.getTimerCount()).toBe(0)
    lines.dispose()
  })
})
