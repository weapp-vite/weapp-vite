import assert from 'node:assert/strict'
import fs from 'node:fs'
import { win32 } from 'node:path'
import { afterEach, it, vi } from 'vitest'
import { instrumentNative } from './probe/native.mjs'

vi.mock('node:path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:path')>()
  return { ...actual, default: actual.win32 }
})

const restorers: Array<() => void> = []

afterEach(() => {
  for (const restore of restorers.splice(0).reverse()) {
    restore()
  }
  vi.restoreAllMocks()
})

it.each([
  { root: String.raw`C:\consumer\fixture`, filename: String.raw`\\?\C:\consumer\fixture\src\reborn` },
  { root: String.raw`\\host\share\fixture`, filename: String.raw`\\?\UNC\host\share\fixture\src\reborn` },
])('Windows namespace 路径命中原始目标，保留注入 Error 身份：$root', ({ root, filename }) => {
  const watch = vi.spyOn(fs, 'watch').mockImplementation(() => {
    throw new Error('The injected acquisition must not reach native watch')
  })
  const original = Object.assign(new Error('original injected EPERM'), { code: 'EPERM', syscall: 'watch', path: filename })
  const instrumentation = instrumentNative(root, { target: win32.join(root, 'src/reborn'), error: original })
  restorers.push(() => instrumentation.restore())
  assert.throws(() => fs.watch(filename), error => error === original)
  assert.equal(instrumentation.injected, 1)
  assert.deepEqual(instrumentation.attempts, ['src/reborn'])
  assert.equal(watch.mock.calls.length, 0)
  assert.equal(original.path, filename)
})

it('fixture 外的 namespace 路径原样调用宿主，不登记或消费注入', () => {
  const outside = String.raw`\\?\C:\other\src`
  const original = new Error('native acquisition failed')
  const watch = vi.spyOn(fs, 'watch').mockImplementation(() => {
    throw original
  })
  const instrumentation = instrumentNative(String.raw`C:\consumer\fixture`, { target: String.raw`C:\consumer\fixture\src`, error: new Error('injected') })
  restorers.push(() => instrumentation.restore())
  assert.throws(() => fs.watch(outside), error => error === original)
  assert.equal(watch.mock.calls[0]?.[0], outside)
  assert.deepEqual(instrumentation.attempts, [])
  assert.equal(instrumentation.injected, 0)
})
