import { Writable } from 'node:stream'
import { expect, it, vi } from 'vitest'
import { createBufferedBuildDiagnosticSink } from './sink'

it('buffers false writes and waits for every callback without dropping lines', async () => {
  const lines: string[] = []
  const callbacks: Array<(error?: Error | null) => void> = []
  const output = new Writable({ highWaterMark: 1, write(chunk, _encoding, callback) {
    lines.push(String(chunk))
    callbacks.push(callback)
  } })
  const sink = createBufferedBuildDiagnosticSink(output)
  sink.write('first\n')
  sink.write('second\n')
  let resolved = false
  const flushing = sink.flush().then((drained) => {
    resolved = true
    return drained
  })
  await Promise.resolve()
  expect(resolved).toBe(false)
  expect(lines).toEqual(['first\n'])
  callbacks.shift()!()
  await Promise.resolve()
  expect(resolved).toBe(false)
  expect(lines).toEqual(['first\n', 'second\n'])
  callbacks.shift()!()
  await expect(flushing).resolves.toBe(true)
  expect(output.writableLength).toBe(0)
  sink.dispose()
  expect(output.listenerCount('error')).toBe(0)
  expect(output.listenerCount('drain')).toBe(0)
})

it('does not call completed callbacks drained while the stream still requires drain', async () => {
  const output = new Writable({ write(_chunk, _encoding, callback) {
    callback()
  } })
  let needsDrain = true
  Object.defineProperty(output, 'writableNeedDrain', { get: () => needsDrain })
  const write = vi.spyOn(output, 'write').mockImplementation((...args: unknown[]) => {
    const callback = args.at(-1) as () => void
    callback()
    return false
  })
  const sink = createBufferedBuildDiagnosticSink(output)
  sink.write('record\n')
  let resolved = false
  const flushing = sink.flush().then((drained) => {
    resolved = true
    return drained
  })
  await Promise.resolve()
  expect(resolved).toBe(false)
  needsDrain = false
  output.emit('drain')
  await expect(flushing).resolves.toBe(true)
  sink.dispose()
  write.mockRestore()
})

it('resolves failure immediately when the stream errors before a write callback', async () => {
  let complete: ((error?: Error | null) => void) | undefined
  const output = new Writable({ write(_chunk, _encoding, callback) {
    complete = callback
  } })
  const sink = createBufferedBuildDiagnosticSink(output)
  sink.write('pending\n')
  const flushing = sink.flush()
  output.emit('error', new Error('broken stream'))
  await expect(flushing).resolves.toBe(false)
  await expect(sink.flush()).resolves.toBe(false)
  sink.dispose()
  expect(output.listenerCount('error')).toBe(1)
  complete!()
  await expect(sink.flush()).resolves.toBe(false)
  expect(output.listenerCount('error')).toBe(0)
})

it('retains its listener until a real asynchronous write error event terminates', async () => {
  const failure = new Error('asynchronous write failure')
  const output = new Writable({ write(_chunk, _encoding, callback) {
    queueMicrotask(() => callback(failure))
  } })
  const sink = createBufferedBuildDiagnosticSink(output)
  sink.write('record\n')
  await expect(sink.flush()).resolves.toBe(false)
  expect(output.errored).toBe(failure)
  sink.dispose()
  expect(output.listenerCount('error')).toBe(1)
  await new Promise(resolve => setImmediate(resolve))
  expect(output.listenerCount('error')).toBe(0)
  expect(output.listenerCount('drain')).toBe(0)
  const unrelated = new Error('later unrelated stream error')
  expect(() => output.emit('error', unrelated)).toThrow(unrelated)
})

it('does not wait for a deferred native error event before reporting flush failure', async () => {
  const failure = new Error('write failure before destroy callback')
  let finishDestroy: (() => void) | undefined
  const output = new Writable({
    write(_chunk, _encoding, callback) {
      queueMicrotask(() => callback(failure))
    },
    destroy(error, callback) {
      finishDestroy = () => callback(error)
    },
  })
  const sink = createBufferedBuildDiagnosticSink(output)
  sink.write('record\n')
  await expect(sink.flush()).resolves.toBe(false)
  sink.dispose()
  expect(output.listenerCount('error')).toBe(1)
  finishDestroy!()
  await new Promise(resolve => setImmediate(resolve))
  expect(output.listenerCount('error')).toBe(0)
  expect(output.listenerCount('drain')).toBe(0)
})

it('owns only its late write callbacks when records arrive after disposal', async () => {
  const lines: string[] = []
  const output = new Writable({ write(chunk, _encoding, callback) {
    lines.push(String(chunk))
    queueMicrotask(callback)
  } })
  const sink = createBufferedBuildDiagnosticSink(output)
  sink.write('first\n')
  await expect(sink.flush()).resolves.toBe(true)
  sink.dispose()
  expect(output.listenerCount('error')).toBe(0)
  sink.write('after terminal\n')
  expect(output.listenerCount('error')).toBe(1)
  await expect(sink.flush()).resolves.toBe(true)
  expect(lines).toEqual(['first\n', 'after terminal\n'])
  expect(output.listenerCount('error')).toBe(0)
  expect(output.listenerCount('drain')).toBe(0)
})

it.each(['throw', 'callback'] as const)('keeps %s failures incomplete and duplicate callbacks idempotent', async (kind) => {
  const output = new Writable({ write(_chunk, _encoding, callback) {
    callback()
  } })
  const failure = new Error('write failure')
  const write = vi.spyOn(output, 'write').mockImplementation((...args: unknown[]) => {
    if (kind === 'throw') {
      throw failure
    }
    const callback = args.at(-1) as (error?: Error | null) => void
    callback(failure)
    callback()
    return false
  })
  const sink = createBufferedBuildDiagnosticSink(output)
  expect(() => sink.write('record\n')).not.toThrow()
  await expect(sink.flush()).resolves.toBe(false)
  sink.write('after failure\n')
  expect(write).toHaveBeenCalledOnce()
  sink.dispose()
  write.mockRestore()
})
