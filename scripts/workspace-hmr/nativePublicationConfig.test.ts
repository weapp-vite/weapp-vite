import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { normalize } from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('../../packages/weapp-vite/scripts/consumerHmr/configWrapper.mjs', () => ({
  createSiblingPluginConfig: vi.fn(async options => options),
}))

const roots: string[] = []

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await rm(root, { recursive: true, force: true })
  }
})

async function fixture(files: string[]) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'workspace-publication-config-'))
  roots.push(root)
  for (const file of files) {
    await writeFile(path.join(root, file), 'export default {}\n')
  }
  const { createWorkspaceNativePublicationConfig } = await import('./nativePublicationConfig')
  const options = await createWorkspaceNativePublicationConfig({ root, sourceRoot: path.join(root, 'miniprogram'), distRoot: path.join(root, 'output/miniapp') }, path.join(root, '.weapp-vite/hmr-profile.jsonl')) as any
  return { root, options }
}

it('preserves default Vite priority and the separate weapp overlay without editing either config', async () => {
  const { root, options } = await fixture(['vite.config.ts', 'vite.config.mjs', 'weapp-vite.config.ts'])
  expect(options.configFiles.map(normalize)).toEqual([path.join(root, 'vite.config.ts'), path.join(root, 'weapp-vite.config.ts')].map(normalize))
  expect(options.pluginExport).toBe('nativePublicationPlugin')
  expect(options.pluginUrl).toBe(new URL('../../e2e/utils/nativePublication/plugin.ts', import.meta.url).href)
  expect({
    ...options.pluginOptions,
    sourceRoot: normalize(options.pluginOptions.sourceRoot),
    outputRoot: normalize(options.pluginOptions.outputRoot),
    profilePath: normalize(options.pluginOptions.profilePath),
  }).toEqual({ sourceRoot: 'miniprogram', outputRoot: 'output/miniapp', profilePath: normalize(path.join(root, '.weapp-vite/hmr-profile.jsonl')) })
  expect(options.mergeUrl).toBe(import.meta.resolve('@weapp-core/shared'))
  expect(options.mergeUrl).toMatch(/^file:/)
  expect(await readFile(path.join(root, 'vite.config.ts'), 'utf8')).toBe('export default {}\n')
  expect(await readFile(path.join(root, 'weapp-vite.config.ts'), 'utf8')).toBe('export default {}\n')
})

it.each(['vite.config.mts', 'weapp-vite.config.mjs'])('keeps a sole %s in its own directory', async (file) => {
  const { root, options } = await fixture([file])
  expect(normalize(options.directory)).toBe(normalize(root))
  expect(options.configFiles.map(normalize)).toEqual([normalize(path.join(root, file))])
  expect(pathToFileURL(options.configFiles[0]).protocol).toBe('file:')
})

it('keeps the default empty config when the project has no config files', async () => {
  const { root, options } = await fixture([])
  expect(normalize(options.directory)).toBe(normalize(root))
  expect(options.configFiles).toEqual([])
})
