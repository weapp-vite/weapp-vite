import { describe, expect, it, vi } from 'vitest'
import { HmrAssetStore } from './assets'
import { captureHmrBatch, normalizeHmrSourceMap, transformHmrBatch, transformHmrPatch } from './batch'
import { HmrCompilerHost } from './compilerHost'
import { HmrTransaction } from './transaction'

it('preserves client metadata, duplicate filenames and original callback order', async () => {
  const batch = captureHmrBatch({ changedFiles: ['a', 'b'], updates: [
    { clientId: 'first', update: { type: 'Patch', code: 'a()', filename: 'patch.js', seq: 3, changedIds: ['a'], extra: { owner: 'first' } } },
    { clientId: 'second', update: { type: 'Patch', code: 'b()', filename: 'patch.js', seq: 4, changedIds: ['b'], extra: { owner: 'second' } } },
    { clientId: 'first', update: { type: 'FullReload', reason: 'metadata' } },
  ] })
  const result = await transformHmrBatch(batch, [{ transformJavaScript: ({ code }) => ({ code: `${code};prepared()` }) }], { sourcemap: false })
  expect(result.updates.map(item => [item.clientId, item.update.type, item.update.filename, item.update.seq])).toEqual([
    ['first', 'Patch', 'patch.js', 3],
    ['second', 'Patch', 'patch.js', 4],
    ['first', 'FullReload', undefined, undefined],
  ])
  expect(result.updates[0]?.update).toMatchObject({ code: 'a();prepared()', changedIds: ['a'], extra: { owner: 'first' } })
  expect(batch.updates[0]?.update.code).toBe('a()')
  expect(result.updates[2]?.update).toEqual({ type: 'FullReload', reason: 'metadata' })
})

it('freezes each source version and disposes prepared providers when another fails', async () => {
  const host = new HmrCompilerHost()
  const dispose = vi.fn()
  host.capture('page.tsx', 'before')
  const first = host.freeze(['page.tsx'])
  host.capture('page.tsx', 'after')
  expect(first.sources.get('page.tsx')).toBe('before')
  host.register('style', async () => ({ dispose }))
  host.register('broken', async () => {
    throw new Error('generation failed')
  })
  await expect(host.prepare(first)).rejects.toThrow('generation failed')
  expect(dispose).toHaveBeenCalledOnce()
})

it('recovers partial writes and removals using committed bytes, including binary producer mutation', async () => {
  const store = new HmrAssetStore()
  const bytes = new Uint8Array([1, 2])
  store.adopt([{ fileName: 'kept.bin', source: bytes }, { fileName: 'deleted.css', source: 'old' }])
  bytes[0] = 9
  const write = vi.fn().mockRejectedValueOnce(new Error('partial write')).mockResolvedValue(undefined)
  await expect(store.commit([{ fileName: 'new.css', source: 'new' }], write)).rejects.toThrow('partial write')
  await store.commit([{ fileName: 'kept.bin', source: new Uint8Array([1, 2]) }], write)
  expect(write.mock.calls[1]?.[0]).toEqual({
    changed: [{ fileName: 'kept.bin', source: new Uint8Array([1, 2]) }],
    removed: ['deleted.css', 'new.css'],
  })
  write.mockClear()
  await store.commit([{ fileName: 'kept.bin', source: new Uint8Array([1, 2]) }], write)
  expect(write).not.toHaveBeenCalled()
})

describe('separate publication and application', () => {
  it('lets a host publish durably and receive application receipts outside its queue', async () => {
    const events: string[] = []
    const identity = { generation: 'build-a', revision: 2 }
    const task = new HmrTransaction({
      identity,
      prepare: async () => {
        events.push('prepare')
        return 'compiled'
      },
      commit: async () => { events.push('commit') },
      publish: async () => { events.push('publish') },
    })
    expect(task.acknowledge(identity)).toBe(false)
    await task.publish()
    expect(events).toEqual(['prepare', 'commit', 'publish'])
    expect(task.phase).toBe('published')
    expect(task.acknowledge({ generation: 'retired', revision: 2 })).toBe(false)
    expect(task.acknowledge({ generation: 'build-a', revision: 3 })).toBe(false)
    expect(task.acknowledge(identity)).toBe(true)
    expect(task.acknowledge(identity)).toBe(false)
    expect(task.phase).toBe('applied')
  })

  it('does not repeat a successful asset commit when publication is retried', async () => {
    const commit = vi.fn(async () => {})
    const publish = vi.fn().mockRejectedValueOnce(new Error('publication failed')).mockResolvedValue(undefined)
    const task = new HmrTransaction({ identity: { generation: 'build', revision: 1 }, prepare: () => 'fixed', commit, publish })
    await expect(task.publish()).rejects.toThrow('publication failed')
    await task.publish()
    expect(commit).toHaveBeenCalledOnce()
    expect(publish).toHaveBeenCalledTimes(2)
  })
})

it('captures nested DevEngine metadata before the producer mutates it', () => {
  const producer = { changedFiles: ['page.ts'], extra: { generation: 1 }, updates: [
    { clientId: 'client', update: { type: 'Patch', seq: 1, filename: 'same.js', code: 'first()', changedIds: ['page.ts'] } },
  ] }
  const captured = captureHmrBatch(producer)
  producer.updates[0]!.update.changedIds.push('later.ts')
  producer.extra.generation = 2
  expect(captured.updates[0]!.update.changedIds).toEqual(['page.ts'])
  expect(captured.extra.generation).toBe(1)
})

it('keeps maps separate for multiple versions of the same filename', async () => {
  const updates = ['first.ts', 'second.ts'].map((source, index) => ({
    clientId: 'client',
    update: { type: 'Patch', seq: index, filename: 'same.js', code: 'value()', sourcemap: JSON.stringify({ version: 3, sources: [source], sourcesContent: ['value()'], names: [], mappings: 'AAAA' }) },
  }))
  const transformed = await transformHmrBatch({ changedFiles: [], updates }, [{
    transformJavaScript: ({ code, fileName }) => ({ code: `${code};`, map: { version: 3, sources: [fileName], sourcesContent: [code], names: [], mappings: 'AAAA' } }),
  }], { sourcemap: true })
  expect(transformed.updates.map(item => JSON.parse(item.update.sourcemap!).sources)).toEqual([['first.ts'], ['second.ts']])
})

it('does not commit or publish after disposal while preparation is pending', async () => {
  let resolve!: (value: string) => void
  const prepared = new Promise<string>((done) => {
    resolve = done
  })
  const commit = vi.fn(async () => {})
  const publish = vi.fn(async () => {})
  const dispose = vi.fn(async () => {})
  const transaction = new HmrTransaction({ identity: { generation: 'build', revision: 1 }, prepare: () => prepared, commit, publish, dispose })
  const delivery = transaction.publish()
  const disposal = transaction.dispose()
  resolve('captured')
  await Promise.all([delivery, disposal])
  await transaction.dispose()
  expect(commit).not.toHaveBeenCalled()
  expect(publish).not.toHaveBeenCalled()
  expect(dispose).toHaveBeenCalledExactlyOnceWith('captured')
  expect(transaction.phase).toBe('disposed')
})

it('rejects overlapping asset commits and protects committed bytes from readers', async () => {
  const store = new HmrAssetStore()
  let release!: () => void
  const writing = new Promise<void>((resolve) => {
    release = resolve
  })
  const first = store.commit([{ fileName: 'style.bin', source: new Uint8Array([1]) }], () => writing)
  await expect(store.commit([], async () => {})).rejects.toThrow('serialized')
  release()
  await first
  const read = store.values().next().value!
  ;(read.source as Uint8Array)[0] = 2
  expect(store.diff([{ fileName: 'style.bin', source: new Uint8Array([1]) }])).toEqual({ changed: [], removed: [] })
})

it('captures native sourcemap getters before serialization and composition', () => {
  const native = Object.create(null)
  for (const [key, value] of Object.entries({ version: 3, sources: ['style.ts'], names: [], mappings: 'AAAA', sourcesContent: ['original'] })) {
    Object.defineProperty(native, key, { get: () => value })
  }
  expect(Object.keys(native)).toEqual([])
  const normalized = normalizeHmrSourceMap(native)
  expect(normalizeHmrSourceMap(JSON.stringify(normalized))).toEqual({ version: 3, sources: ['style.ts'], names: [], mappings: 'AAAA', sourcesContent: ['original'] })
})

it('transfers output ownership without deleting a filename now emitted as a host chunk', async () => {
  const store = new HmrAssetStore()
  store.adopt([{ fileName: 'entry.js', source: 'old asset' }])
  const write = vi.fn(async () => {})
  await store.commit([], write, ['entry.js'])
  expect(write).not.toHaveBeenCalled()
  expect(store.ownedNames()).toEqual([])
})

it('honors disabled sourcemaps without consuming a provider map', async () => {
  const transform = vi.fn(({ code, sourcemap }) => {
    expect(sourcemap).toBe(false)
    return { code: `${code};updated()`, map: { unused: true } }
  })
  const result = await transformHmrBatch({ changedFiles: [], updates: [
    { clientId: 'client', update: { type: 'Patch', filename: 'patch.js', code: 'before()', seq: 1 } },
  ] }, [{ transformJavaScript: transform }], { sourcemap: false })
  expect(result.updates[0]!.update).toMatchObject({ code: 'before();updated()', seq: 1 })
  expect(result.updates[0]!.update.sourcemap).toBeUndefined()
})

it('preserves sourceMappingURL text inside JavaScript literals', async () => {
  const code = 'const text = `\n//# sourceMappingURL=example.map`'
  expect((await transformHmrPatch({ code, filename: 'patch.js' }, [], false)).code).toBe(code)
})

it('removes a generated trailing sourcemap directive', async () => {
  const code = 'run()\n//# sourceMappingURL=data:application/json;base64,e30=\n'
  expect((await transformHmrPatch({ code, filename: 'patch.js' }, [], false)).code.trimEnd()).toBe('run()')
})
