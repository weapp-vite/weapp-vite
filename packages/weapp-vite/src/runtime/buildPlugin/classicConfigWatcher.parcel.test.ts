import type { SubscribeCallback } from '@parcel/watcher'
import type { ClassicConfigWatcher } from './classicConfigWatcher'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClassicConfigWatcher } from './classicConfigWatcher'

const mocks = vi.hoisted(() => ({ subscribe: vi.fn() }))
vi.mock('@parcel/watcher', () => ({ subscribe: mocks.subscribe }))

let root: string
let owner: ClassicConfigWatcher | undefined

beforeEach(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'classic-config-parcel-')))
  mocks.subscribe.mockReset()
})

afterEach(async () => {
  await owner?.close()
  owner = undefined
  await rm(root, { recursive: true, force: true })
})

describe('classic configuration Parcel subscription reuse', () => {
  it('adds and removes imported files in one parent without replacing its native subscription', async () => {
    const entry = path.join(root, 'vite.config.ts')
    const imported = path.join(root, 'mini.config.ts')
    await Promise.all([writeFile(entry, 'entry'), writeFile(imported, 'before')])
    const unsubscribe = vi.fn(async () => {})
    let callback: SubscribeCallback | undefined
    mocks.subscribe.mockImplementation(async (_directory: string, listener: SubscribeCallback) => {
      callback = listener
      return { unsubscribe }
    })
    const config = {
      inlineConfig: { weapp: { watch: { engine: 'parcel' as const } } },
      configFileDependencies: [entry],
    }
    owner = createClassicConfigWatcher(config, vi.fn())
    await owner.updateDependencies()
    expect(mocks.subscribe).toHaveBeenCalledOnce()
    const request = vi.fn()
    owner.subscribe(request)
    config.configFileDependencies = [entry, imported]
    let effective: string | undefined
    const load = vi.fn(async () => {
      effective = await readFile(imported, 'utf8')
    })
    await owner.reload(load, () => false)
    expect(load).toHaveBeenCalledTimes(2)
    expect(effective).toBe('before')
    expect(mocks.subscribe).toHaveBeenCalledOnce()
    expect(unsubscribe).not.toHaveBeenCalled()
    expect(owner.hasPendingChanges).toBe(false)

    await writeFile(imported, 'first-save-after-registration')
    callback!(null, [{ type: 'update', path: imported }])
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
    await owner.reload(load, () => false)
    expect(effective).toBe('first-save-after-registration')
    config.configFileDependencies = [entry]
    await owner.updateDependencies()
    await writeFile(imported, 'removed-dependency')
    callback!(null, [{ type: 'update', path: imported }])
    // 再次更新等待 adapter 的已排队工作，不能靠固定等待掩盖删除后的错误通知。
    await owner.updateDependencies()
    expect(request).toHaveBeenCalledOnce()
    expect(owner.hasPendingChanges).toBe(false)
    expect(mocks.subscribe).toHaveBeenCalledOnce()
    await owner.close()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
