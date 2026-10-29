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

async function fixture(original = '{"setting":{"compileHotReLoad":true},"watchOptions":{"ignore":["user/**"]}}\n') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'classic-pending-handoff-'))
  cleanup.push(() => fs.remove(root))
  const configPath = path.join(root, 'project.private.config.json')
  const outDir = path.join(root, 'dist')
  await fs.writeFile(configPath, original)
  const restore = await installIdeAssetWatch({ configPath, outDir })
  const owner = new ClassicIdeConfigOwner()
  cleanup.push(() => owner.close())
  const installed = await fs.readFile(configPath, 'utf8')
  const assetJournal = ideAssetWatchLeasePath(configPath)
  const assetLease = await fs.readFile(assetJournal, 'utf8')
  const { owner: assetOwner } = JSON.parse(assetLease) as { owner: string }
  await restore(owner)
  return { configPath, outDir, original, installed, owner, restore, assetOwner, assetJournal, assetLease, classicJournal: classicIdeConfigLeasePath(configPath) }
}

it('transfers only metadata until activation and keeps both exact asset bytes and the requested view', async () => {
  const project = await fixture()
  expect(await fs.readFile(project.configPath, 'utf8')).toBe(project.installed)
  expect(await fs.readFile(project.assetJournal, 'utf8')).toBe(project.assetLease)
  expect(await fs.pathExists(project.classicJournal)).toBe(false)
  expect(await project.owner.readRequested(project.configPath)).toBe(project.original)
  expect(project.owner.preservesPendingOutput(project.outDir)).toBe(true)
  expect(project.owner.preservesPendingOutput(path.join(project.outDir, 'another'))).toBe(false)
  await project.owner.addPendingAssetHandoff(project.configPath, { assetOwner: project.assetOwner, outDir: project.outDir })
  expect(await fs.readFile(project.assetJournal, 'utf8')).toBe(project.assetLease)
  const publication = await project.owner.preparePublication(project.configPath, '{}')
  expect(publication).toEqual({ source: '{}', deferred: true })
})

it('re-reads user edits at activation and restores the latest request with BOM and CRLF', async () => {
  const project = await fixture('\uFEFF{\r\n\t"setting": { "compileHotReLoad": true }\r\n}\r\n')
  const current = JSON.parse(project.installed.replace(/^\uFEFF/u, '')) as { setting: Record<string, unknown>, watchOptions: { ignore: string[] }, description?: string }
  current.setting.urlCheck = false
  current.description = 'edited during handoff'
  current.watchOptions.ignore.push('user-added/**')
  await fs.writeFile(project.configPath, `\uFEFF${JSON.stringify(current, null, '\t').replaceAll('\n', '\r\n')}\r\n`)
  await project.owner.activatePendingAssetHandoff(project.configPath, project.outDir)
  const installed = await fs.readFile(project.configPath, 'utf8')
  expect(installed.startsWith('\uFEFF')).toBe(true)
  expect(installed.replaceAll('\r\n', '')).not.toContain('\n')
  expect(JSON.parse(installed.replace(/^\uFEFF/u, ''))).toEqual({
    setting: { compileHotReLoad: false, urlCheck: false },
    description: 'edited during handoff',
    watchOptions: { ignore: ['user-added/**'] },
  })
  expect(await fs.pathExists(project.assetJournal)).toBe(false)
  expect(await fs.pathExists(project.classicJournal)).toBe(true)
  const requested = await project.owner.readRequested(project.configPath)
  expect(JSON.parse(requested.replace(/^\uFEFF/u, '')).setting.compileHotReLoad).toBe(true)
  await project.owner.close()
  expect(await fs.readFile(project.configPath, 'utf8')).toBe(requested)
})

it('activates one project once while another project remains pending', async () => {
  const first = await fixture()
  const second = await fixture()
  const write = vi.spyOn(fsNative, 'rename')
  await Promise.all([
    first.owner.activatePendingAssetHandoff(first.configPath, first.outDir),
    first.owner.activatePendingAssetHandoff(first.configPath, first.outDir),
  ])
  expect(write.mock.calls.filter(([, file]) => file === first.configPath)).toHaveLength(1)
  expect(await fs.readFile(second.configPath, 'utf8')).toBe(second.installed)
  expect(await fs.readFile(second.assetJournal, 'utf8')).toBe(second.assetLease)
  await first.owner.close()
  expect(await fs.readFile(second.configPath, 'utf8')).toBe(second.installed)
})

it('restores an unpublished pending lease on terminal close without creating a classic journal', async () => {
  const project = await fixture()
  const closing = project.owner.close()
  expect(project.owner.close()).toBe(closing)
  await closing
  expect(await fs.readFile(project.configPath, 'utf8')).toBe(project.original)
  expect(await fs.pathExists(project.assetJournal)).toBe(false)
  expect(await fs.pathExists(project.classicJournal)).toBe(false)
  expect(project.owner.preservesPendingOutput(project.outDir)).toBe(false)
  await project.restore()
  expect(await fs.readFile(project.configPath, 'utf8')).toBe(project.original)
})

it.each([false, true])('preserves a user-deleted config through pending cleanup: activate=%s', async (activate) => {
  const project = await fixture()
  await fs.remove(project.configPath)
  if (activate) {
    await project.owner.activatePendingAssetHandoff(project.configPath, project.outDir)
    expect(await fs.readJSON(project.configPath)).toEqual({ setting: { compileHotReLoad: false } })
  }
  await project.owner.close()
  expect(await fs.pathExists(project.configPath)).toBe(false)
  expect(await fs.pathExists(project.assetJournal)).toBe(false)
  expect(await fs.pathExists(project.classicJournal)).toBe(false)
})

it('refuses a different publication root and preserves the exact failure while cleaning only its pending lease', async () => {
  const project = await fixture()
  const failure = await project.owner.activatePendingAssetHandoff(project.configPath, path.join(project.outDir, 'other')).catch((error: unknown) => error)
  expect(failure).toBeInstanceOf(Error)
  expect(await fs.readFile(project.configPath, 'utf8')).toBe(project.installed)
  expect(await fs.pathExists(project.classicJournal)).toBe(false)
  await expect(project.owner.close()).rejects.toBe(failure)
  expect(await fs.readFile(project.configPath, 'utf8')).toBe(project.original)
})

it('does not touch a replacement asset owner during activation or terminal close', async () => {
  const project = await fixture()
  const replacement = { ...JSON.parse(project.assetLease) as Record<string, unknown>, owner: 'replacement-owner' }
  await fs.writeJSON(project.assetJournal, replacement)
  const replaced = await fs.readFile(project.assetJournal, 'utf8')
  await expect(project.owner.activatePendingAssetHandoff(project.configPath, project.outDir)).rejects.toThrow('租约身份不匹配')
  await expect(project.owner.close()).rejects.toBeInstanceOf(Error)
  expect(await fs.readFile(project.assetJournal, 'utf8')).toBe(replaced)
  expect(await fs.readFile(project.configPath, 'utf8')).toBe(project.installed)
  expect(await fs.pathExists(project.classicJournal)).toBe(false)
})
