import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import picomatch from 'picomatch'
import { afterEach, expect, it } from 'vitest'
import { installIdeAssetWatch, restoreIdeAssetWatch } from './assetWatch'

const roots: string[] = []
afterEach(async () => {
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
  await installIdeAssetWatch({ ...options, inheritedWatchOptions: { ignore: ['scratch/**'] } })
  const config = await fs.readJSON(options.configPath) as { setting: Record<string, unknown>, watchOptions: { ignore: string[] } }
  config.setting.urlCheck = false
  config.watchOptions.ignore.push('user-added/**')
  await fs.writeJSON(options.configPath, config)
  await restoreIdeAssetWatch(options.configPath)
  expect(await fs.readJSON(options.configPath)).toEqual({
    setting: { compileHotReLoad: true, urlCheck: false },
    watchOptions: { ignore: ['user-added/**'] },
  })
})

it('recovers an interrupted session before another install and removes newly created private config', async () => {
  const options = await fixture()
  await installIdeAssetWatch(options)
  const first = await fs.readFile(options.configPath, 'utf8')
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
