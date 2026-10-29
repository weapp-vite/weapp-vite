import fsNative from 'node:fs/promises'
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
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'classic-handoff-race-'))
  cleanup.push(() => fs.remove(root))
  const configPath = path.join(root, 'project.private.config.json')
  const outDir = path.join(root, 'dist')
  const original = '{"setting":{"compileHotReLoad":true}}\n'
  await fs.writeFile(configPath, original)
  const restore = await installIdeAssetWatch({ configPath, outDir })
  const owner = new ClassicIdeConfigOwner()
  cleanup.push(() => owner.close())
  await restore(owner)
  return { configPath, outDir, original, owner, installed: await fs.readFile(configPath, 'utf8'), assetJournal: ideAssetWatchLeasePath(configPath), classicJournal: classicIdeConfigLeasePath(configPath) }
}

it.each([1, 3])('cancels an obsolete publication at asset check %s without poisoning the next full publication', async (blockedCheck) => {
  const project = await fixture()
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const read = fs.readJSON.bind(fs)
  let reads = 0
  let active = true
  vi.spyOn(fs, 'readJSON').mockImplementation(async (target, ...args) => {
    const result = await read(target, ...args)
    if (target === project.assetJournal && ++reads === blockedCheck) {
      entered.resolve()
      await release.promise
    }
    return result
  })
  const activation = project.owner.activatePendingAssetHandoff(project.configPath, project.outDir, () => active)
  await entered.promise
  active = false
  release.resolve()
  expect(await activation).toBe(false)
  expect(await fs.readFile(project.configPath, 'utf8')).toBe(project.installed)
  expect(await fs.pathExists(project.classicJournal)).toBe(false)
  expect(await fs.pathExists(project.assetJournal)).toBe(true)
  expect(project.owner.hasPendingAssetHandoff(project.configPath)).toBe(true)
  active = true
  expect(await project.owner.activatePendingAssetHandoff(project.configPath, project.outDir, () => active)).toBe(true)
  await project.owner.close()
  expect(await fs.readFile(project.configPath, 'utf8')).toBe(project.original)
})

it('waits for activation before reading source and never reads a deleted asset lease', async () => {
  const project = await fixture()
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const rename = fsNative.rename.bind(fs)
  vi.spyOn(fsNative, 'rename').mockImplementation(async (source, target) => {
    if (target === project.configPath && (await fs.readFile(source, 'utf8')).includes('false')) {
      entered.resolve()
      await release.promise
    }
    return rename(source, target)
  })
  const activation = project.owner.activatePendingAssetHandoff(project.configPath, project.outDir)
  await entered.promise
  const read = vi.fn(() => fs.readFile(project.configPath, 'utf8'))
  const requested = project.owner.readRequested(project.configPath, read)
  expect(read).not.toHaveBeenCalled()
  release.resolve()
  expect(await activation).toBe(true)
  expect(await requested).toBe(project.original)
  expect(read).toHaveBeenCalledOnce()
  expect(await fs.pathExists(project.assetJournal)).toBe(false)
})

it('keeps the pending token until an earlier request-view read has finished', async () => {
  const project = await fixture()
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const requested = project.owner.readRequested(project.configPath, async () => {
    entered.resolve()
    await release.promise
    return fs.readFile(project.configPath, 'utf8')
  })
  await entered.promise
  const activation = project.owner.activatePendingAssetHandoff(project.configPath, project.outDir)
  expect(await fs.readFile(project.configPath, 'utf8')).toBe(project.installed)
  expect(await fs.pathExists(project.assetJournal)).toBe(true)
  release.resolve()
  expect(await requested).toBe(project.original)
  expect(await activation).toBe(true)
})

it('waits for an acquired config write during close and restores exactly once', async () => {
  const project = await fixture()
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const rename = fsNative.rename.bind(fs)
  vi.spyOn(fsNative, 'rename').mockImplementation(async (source, target) => {
    if (target === project.configPath && (await fs.readFile(source, 'utf8')).includes('false')) {
      entered.resolve()
      await release.promise
    }
    return rename(source, target)
  })
  const activation = project.owner.activatePendingAssetHandoff(project.configPath, project.outDir)
  await entered.promise
  const closing = project.owner.close()
  expect(project.owner.close()).toBe(closing)
  await expect(project.owner.activatePendingAssetHandoff(project.configPath, project.outDir)).rejects.toThrow('已关闭')
  release.resolve()
  expect(await activation).toBe(true)
  await closing
  expect(await fs.readFile(project.configPath, 'utf8')).toBe(project.original)
  expect(await fs.pathExists(project.assetJournal)).toBe(false)
  expect(await fs.pathExists(project.classicJournal)).toBe(false)
})

it.each(['config-write', 'asset-journal-remove'] as const)('keeps the first %s failure and restores each held lease on terminal close', async (stage) => {
  const project = await fixture()
  const failure = new Error(`${stage} failed`)
  let failed = false
  if (stage === 'config-write') {
    const rename = fsNative.rename.bind(fs)
    vi.spyOn(fsNative, 'rename').mockImplementation(async (source, target) => {
      if (!failed && target === project.configPath && (await fs.readFile(source, 'utf8')).includes('false')) {
        failed = true
        throw failure
      }
      return rename(source, target)
    })
  }
  else {
    const remove = fs.remove.bind(fs)
    vi.spyOn(fs, 'remove').mockImplementation(async (target) => {
      if (!failed && target === project.assetJournal) {
        failed = true
        throw failure
      }
      return remove(target)
    })
  }
  await expect(project.owner.activatePendingAssetHandoff(project.configPath, project.outDir)).rejects.toBe(failure)
  expect(project.owner.hasPendingAssetHandoff(project.configPath)).toBe(true)
  expect(await fs.pathExists(project.assetJournal)).toBe(true)
  expect(await fs.pathExists(project.classicJournal)).toBe(true)
  await expect(project.owner.activatePendingAssetHandoff(project.configPath, project.outDir)).rejects.toBe(failure)
  const closing = project.owner.close()
  await expect(closing).rejects.toBe(failure)
  await expect(project.owner.close()).rejects.toBe(failure)
  expect(await fs.readFile(project.configPath, 'utf8')).toBe(project.original)
  expect(await fs.pathExists(project.assetJournal)).toBe(false)
  expect(await fs.pathExists(project.classicJournal)).toBe(false)
})
