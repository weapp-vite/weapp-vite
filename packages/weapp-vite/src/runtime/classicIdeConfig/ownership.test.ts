import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { installIdeAssetWatch } from '../statefulHmr/assetWatch'
import { ClassicIdeConfigOwner } from './index'
import { classicIdeConfigLeasePath, ideAssetWatchLeasePath } from './leases'

const cleanup: Array<() => Promise<unknown>> = []
afterEach(async () => {
  vi.restoreAllMocks()
  for (const close of cleanup.splice(0).reverse()) {
    await close().catch(() => {})
  }
})

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ide-mode-ownership-'))
  cleanup.push(() => fs.remove(root))
  const configPath = path.join(root, 'project.private.config.json')
  const original = '{ "setting": { "compileHotReLoad": true }, "watchOptions": { "ignore": ["user/**"] } }\r\n'
  await fs.writeFile(configPath, original)
  const classic = new ClassicIdeConfigOwner()
  cleanup.push(() => classic.close())
  return { configPath, outDir: path.join(root, 'dist'), original, classic }
}

it('rejects classic acquisition while an asset owner remains live without changing its bytes', async () => {
  const { classic, original, ...options } = await fixture()
  const restore = await installIdeAssetWatch(options)
  cleanup.push(restore)
  const installed = await fs.readFile(options.configPath, 'utf8')
  const failure = await classic.activate(options.configPath).catch((error: unknown) => error)
  expect(failure).toBeInstanceOf(Error)
  expect(await fs.readFile(options.configPath, 'utf8')).toBe(installed)
  await expect(classic.close()).rejects.toBe(failure)
  await restore()
  expect(await fs.readFile(options.configPath, 'utf8')).toBe(original)
})

it('rejects stateful acquisition while classic owns the configuration', async () => {
  const { classic, original, ...options } = await fixture()
  await classic.activate(options.configPath)
  const installed = await fs.readFile(options.configPath, 'utf8')
  await expect(installIdeAssetWatch(options)).rejects.toThrow('其他 owner')
  expect(await fs.readFile(options.configPath, 'utf8')).toBe(installed)
  expect(await fs.pathExists(ideAssetWatchLeasePath(options.configPath))).toBe(false)
  await classic.close()
  expect(await fs.readFile(options.configPath, 'utf8')).toBe(original)
})

it('releases only its unwritten journal when an asset owner wins between the two acquisition checks', async () => {
  const { classic, original, ...options } = await fixture()
  const probed = Promise.withResolvers<void>()
  const released = Promise.withResolvers<void>()
  const assetJournal = ideAssetWatchLeasePath(options.configPath)
  const exists = fs.pathExists.bind(fs)
  let first = true
  vi.spyOn(fs, 'pathExists').mockImplementation(async (target) => {
    const observed = await exists(target)
    if (target === assetJournal && first) {
      first = false
      probed.resolve()
      await released.promise
    }
    return observed
  })
  const acquiring = classic.activate(options.configPath).catch((error: unknown) => error)
  await probed.promise
  let restore: (() => Promise<void>) | undefined
  try {
    restore = await installIdeAssetWatch(options)
    cleanup.push(restore)
  }
  finally {
    released.resolve()
  }
  const installed = await fs.readFile(options.configPath, 'utf8')
  const failure = await acquiring
  expect(failure).toBeInstanceOf(Error)
  await expect(classic.close()).rejects.toBe(failure)
  expect(await fs.pathExists(classicIdeConfigLeasePath(options.configPath))).toBe(false)
  expect(await fs.pathExists(assetJournal)).toBe(true)
  expect(await fs.readFile(options.configPath, 'utf8')).toBe(installed)
  await restore!()
  expect(await fs.readFile(options.configPath, 'utf8')).toBe(original)
})

it('rechecks both exclusive journals before concurrent owners can write the configuration', async () => {
  const { classic, original, ...options } = await fixture()
  const journals = new Set([classicIdeConfigLeasePath(options.configPath), ideAssetWatchLeasePath(options.configPath)])
  const probed = Promise.withResolvers<void>()
  const acquired = Promise.withResolvers<void>()
  const rechecked = Promise.withResolvers<void>()
  const probes = new Map<string, number>()
  let acquisitionCount = 0
  let recheckCount = 0
  const exists = fs.pathExists.bind(fs)
  vi.spyOn(fs, 'pathExists').mockImplementation(async (target) => {
    const observed = await exists(target)
    if (!journals.has(String(target))) {
      return observed
    }
    const count = (probes.get(String(target)) ?? 0) + 1
    probes.set(String(target), count)
    if (count === 1) {
      if (probes.size === 2) {
        probed.resolve()
      }
      await probed.promise
    }
    else if (count === 2) {
      if (++recheckCount === 2) {
        rechecked.resolve()
      }
      await rechecked.promise
    }
    return observed
  })
  const write = fs.writeFile.bind(fs)
  const writes = vi.spyOn(fs, 'writeFile').mockImplementation(async (target, ...args) => {
    await write(target, ...args)
    if (journals.has(String(target))) {
      if (++acquisitionCount === 2) {
        acquired.resolve()
      }
      await acquired.promise
    }
  })
  const [classicResult, assetResult] = await Promise.allSettled([classic.activate(options.configPath), installIdeAssetWatch(options)])
  expect(classicResult.status).toBe('rejected')
  expect(assetResult.status).toBe('rejected')
  expect(writes.mock.calls.filter(([file]) => file === options.configPath)).toEqual([])
  expect(await fs.readFile(options.configPath, 'utf8')).toBe(original)
  if (classicResult.status === 'rejected') {
    await expect(classic.close()).rejects.toBe(classicResult.reason)
  }
  expect(await fs.pathExists(ideAssetWatchLeasePath(options.configPath))).toBe(false)
})
