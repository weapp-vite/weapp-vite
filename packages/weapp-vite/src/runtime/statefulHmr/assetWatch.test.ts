import fsNative from 'node:fs/promises'
import os from 'node:os'
import process from 'node:process'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import picomatch from 'picomatch'
import { afterEach, expect, it, vi } from 'vitest'
import { ClassicIdeConfigOwner } from '../classicIdeConfig'
import { installIdeAssetWatch, restoreIdeAssetWatch } from './assetWatch'

const roots: string[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => fs.remove(root)))
})

async function fixture(original?: string) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ide-asset-watch-'))
  roots.push(root)
  const configPath = path.join(root, 'project.private.config.json')
  if (original !== undefined) {
    await fs.writeFile(configPath, original)
  }
  return { configPath, outDir: path.join(root, 'dist') }
}

it('keeps the old config while handing its lease to classic and activates once before publication', async () => {
  const original = '{\r\n  "setting": { "compileHotReLoad": true },\r\n  "watchOptions": { "ignore": ["user/**"] }\r\n}\r\n'
  const options = await fixture(original)
  const restore = await installIdeAssetWatch(options)
  const installed = await fs.readFile(options.configPath, 'utf8')
  const classic = new ClassicIdeConfigOwner()
  const publish = vi.spyOn(fsNative, 'rename')
  try {
    await restore(classic)
    expect(publish.mock.calls.filter(([, file]) => file === options.configPath)).toHaveLength(0)
    expect(await fs.readFile(options.configPath, 'utf8')).toBe(installed)
    expect(classic.hasPendingAssetHandoff(options.configPath, options.outDir)).toBe(true)
    expect(await classic.readRequested(options.configPath)).toBe(original)
    await classic.activatePendingAssetHandoff(options.configPath, options.outDir)
    expect(publish.mock.calls.filter(([, file]) => file === options.configPath)).toHaveLength(1)
    expect(await fs.readJSON(options.configPath)).toEqual({ setting: { compileHotReLoad: false }, watchOptions: { ignore: ['user/**'] } })
    expect(await classic.readRequested(options.configPath)).toBe(original)
    await restore(classic)
    await classic.activatePendingAssetHandoff(options.configPath, options.outDir)
    expect(publish.mock.calls.filter(([, file]) => file === options.configPath)).toHaveLength(1)
  }
  finally {
    await classic.close()
  }
  expect(await fs.readFile(options.configPath, 'utf8')).toBe(original)
})

it.each([false, true])('preserves BOM and CRLF through asset cleanup and classic handoff=%s', async (handoff) => {
  const original = '\uFEFF{\r\n  "setting": { "compileHotReLoad": true },\r\n  "watchOptions": { "ignore": ["user/**"] }\r\n}\r\n'
  const options = await fixture(original)
  const restore = await installIdeAssetWatch(options)
  expect((await fs.readFile(options.configPath, 'utf8')).startsWith('\uFEFF')).toBe(true)
  const classic = handoff ? new ClassicIdeConfigOwner() : undefined
  try {
    await restore(classic)
    if (classic) {
      await classic.activatePendingAssetHandoff(options.configPath, options.outDir)
      expect(await classic.readRequested(options.configPath)).toBe(original)
      expect((await fs.readJSON(options.configPath) as { setting: { compileHotReLoad: boolean } }).setting.compileHotReLoad).toBe(false)
    }
  }
  finally {
    await classic?.close()
  }
  expect(await fs.readFile(options.configPath, 'utf8')).toBe(original)
})

it.each(['unknown', 'live'] as const)('keeps the asset journal and first error when classic encounters a conflicting %s journal', async (kind) => {
  const options = await fixture('{}')
  const restore = await installIdeAssetWatch(options)
  const classic = new ClassicIdeConfigOwner()
  const journal = path.join(path.dirname(options.configPath), '.weapp-vite/ide-classic-project.private.config.json')
  const competingLease = kind === 'live'
    ? { schemaVersion: 1, pid: process.pid, owner: 'unrelated-owner', original: '{}', installed: '{"setting":{"compileHotReLoad":false}}' }
    : { owner: 'unrelated-owner' }
  await fs.outputJSON(journal, competingLease)
  const installed = await fs.readFile(options.configPath, 'utf8')
  const failure = await restore(classic).catch((error: unknown) => error)
  expect(failure).toMatchObject({ code: 'EEXIST' })
  expect(failure).toMatchObject({ message: expect.stringMatching(kind === 'live' ? /另一个开发命令持有/ : /缺少可信进程身份或已损坏/) })
  expect(await fs.readJSON(journal)).toEqual(competingLease)
  expect(await fs.readFile(options.configPath, 'utf8')).toBe(installed)
  expect(await fs.pathExists(path.join(path.dirname(options.configPath), '.weapp-vite/ide-asset-watch.json'))).toBe(true)
  await expect(classic.close()).rejects.toBe(failure)
  await expect(restore()).rejects.toBe(failure)
})

it('does not let a retired restore release a replacement asset owner', async () => {
  const options = await fixture('{}')
  const first = await installIdeAssetWatch(options)
  await first()
  const second = await installIdeAssetWatch(options)
  const installed = await fs.readFile(options.configPath, 'utf8')
  await first()
  await expect(restoreIdeAssetWatch(options.configPath, 'unrelated-owner')).rejects.toThrow('租约身份不匹配')
  await expect(restoreIdeAssetWatch(options.configPath)).rejects.toThrow('租约身份不匹配')
  expect(await fs.readFile(options.configPath, 'utf8')).toBe(installed)
  expect(await fs.pathExists(path.join(path.dirname(options.configPath), '.weapp-vite/ide-asset-watch.json'))).toBe(true)
  await second()
  expect(await fs.readFile(options.configPath, 'utf8')).toBe('{}')
})

it('delegates only output static assets and restores the exact original config', async () => {
  const original = '{"setting":{"compileHotReLoad":true},"watchOptions":{"ignore":["scratch/**"]}}\n'
  const options = await fixture(original)
  const restore = await installIdeAssetWatch(options)
  const config = await fs.readJSON(options.configPath) as { watchOptions: { ignore: string[] } }
  const ignored = picomatch(config.watchOptions.ignore)
  for (const file of ['dist/resources/a.png', 'dist/a.svg', 'dist/nested/a.wasm', 'scratch/notes']) {
    expect(ignored(file), file).toBe(true)
  }
  for (const file of ['src/a.png', 'other/a.png', 'dist/pages/index.js', 'dist/pages/index.wxml', 'dist/pages/index.wxss', 'dist/app.json', 'dist/scripts/a.wxs']) {
    expect(ignored(file), file).toBe(false)
  }
  await restore()
  expect(await fs.readFile(options.configPath, 'utf8')).toBe(original)
})

it('preserves user edits while removing owned and inherited temporary rules', async () => {
  const options = await fixture('{"setting":{"compileHotReLoad":true}}')
  const restore = await installIdeAssetWatch({ ...options, inheritedWatchOptions: { ignore: ['scratch/**'] } })
  const config = await fs.readJSON(options.configPath) as { setting: Record<string, unknown>, watchOptions: { ignore: string[] } }
  config.setting.urlCheck = false
  config.watchOptions.ignore.push('user-added/**')
  await fs.writeJSON(options.configPath, config)
  await restore()
  expect(await fs.readJSON(options.configPath)).toEqual({
    setting: { compileHotReLoad: true, urlCheck: false },
    watchOptions: { ignore: ['user-added/**'] },
  })
})

it('refuses an existing asset lease and removes only its own newly created private config', async () => {
  const options = await fixture()
  const firstRestore = await installIdeAssetWatch(options)
  const first = await fs.readFile(options.configPath, 'utf8')
  await expect(installIdeAssetWatch(options)).rejects.toMatchObject({ code: 'EEXIST' })
  expect(await fs.readFile(options.configPath, 'utf8')).toBe(first)
  await firstRestore()
  const restore = await installIdeAssetWatch(options)
  expect(await fs.readFile(options.configPath, 'utf8')).toBe(first)
  await restore()
  expect(await fs.pathExists(options.configPath)).toBe(false)
  await restoreIdeAssetWatch(options.configPath)
})

it('leaves relocated compiler configs intact when their outputs are outside the IDE watch root', async () => {
  const options = await fixture('{}')
  const restore = await installIdeAssetWatch({ ...options, outDir: path.dirname(path.dirname(options.outDir)) })
  expect(await fs.readFile(options.configPath, 'utf8')).toBe('{}')
  expect(await fs.pathExists(path.join(path.dirname(options.configPath), '.weapp-vite'))).toBe(false)
  await restore()
  expect(await fs.readFile(options.configPath, 'utf8')).toBe('{}')
})

it('keeps JSON-declared assets in the IDE index while delegating other assets', async () => {
  const options = await fixture('{}')
  await installIdeAssetWatch({ ...options, output: [
    { type: 'asset', fileName: 'app.json', source: JSON.stringify({ tabBar: { list: [
      { iconPath: 'icons/home.png', selectedIconPath: 'icons/home-active.png' },
      { iconPath: '@tabIcon' },
    ] } }) },
    { type: 'asset', fileName: 'theme.json', source: JSON.stringify({ light: { tabIcon: 'icons/themed.png' } }) },
    { type: 'asset', fileName: 'pages/index.json', source: JSON.stringify({ custom: 'icons/a+b.png' }) },
  ] })
  const config = await fs.readJSON(options.configPath) as { watchOptions: { ignore: string[] } }
  const ignored = picomatch(config.watchOptions.ignore)
  for (const file of ['dist/icons/home.png', 'dist/icons/home-active.png', 'dist/icons/themed.png', 'dist/icons/a+b.png']) {
    expect(ignored(file), file).toBe(false)
  }
  for (const file of ['dist/resources/live.png', 'dist/public.png', 'dist/icons/other.svg']) {
    expect(ignored(file), file).toBe(true)
  }
})
