import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { loadHostRolldown, loadHostRolldownBuild, resolveViteHost } from './engine'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function hostFixture(kind: 'vite' | 'vite-plus', source = 'export function dev() {} export function scan() {} export function rolldown() {}') {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'vite-host-engine-')))
  roots.push(root)
  const host = path.join(root, 'node_modules/vite')
  await mkdir(host, { recursive: true })
  const bundled = kind === 'vite-plus'
  await writeFile(path.join(host, 'package.json'), JSON.stringify({
    name: bundled ? '@voidzero-dev/vite-plus-core' : 'vite',
    version: bundled ? '1.0.0' : '8.3.1',
    type: 'module',
    exports: { './package.json': './package.json', ...(bundled ? { './rolldown/experimental': './engine.js', './rolldown': './engine.js' } : {}) },
  }))
  const engine = bundled ? path.join(host, 'engine.js') : path.join(host, 'node_modules/rolldown/engine.js')
  if (!bundled) {
    await mkdir(path.dirname(engine), { recursive: true })
    await writeFile(path.join(path.dirname(engine), 'package.json'), JSON.stringify({
      name: 'rolldown',
      version: '1.2.11',
      type: 'module',
      exports: { '.': './engine.js', './experimental': './engine.js' },
    }))
  }
  await writeFile(engine, source)
  return { importer: path.join(root, 'consumer.mjs'), engine }
}

it.each(['vite', 'vite-plus'] as const)('loads the exact %s engine module without requiring a flat dependency layout', async (kind) => {
  const { importer, engine } = await hostFixture(kind)
  const identity = resolveViteHost(importer)
  expect(identity.kind).toBe(kind)
  expect(identity.experimentalPath).toBe(engine)
  expect(await loadHostRolldown(importer)).toBe(await import(pathToFileURL(engine).href))
  expect(await loadHostRolldownBuild(importer)).toBe(await import(pathToFileURL(engine).href))
})

it('reports missing host capabilities instead of silently loading the library engine', async () => {
  const { importer } = await hostFixture('vite-plus', 'export const scan = 1')
  await expect(loadHostRolldown(importer)).rejects.toThrow('vite-plus@1.0.0')
})
