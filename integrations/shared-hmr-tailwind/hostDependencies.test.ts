import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readHostDependencyOverrides } from './hostDependencies.mjs'
import { parseLockDocuments } from './test/parseLock'

async function createInstalledPackage(root: string, name: string, version: string, dependencies: Record<string, string> = {}, exportManifest = false) {
  await mkdir(path.join(root, 'dist'), { recursive: true })
  await writeFile(path.join(root, 'package.json'), JSON.stringify({
    name,
    version,
    type: 'module',
    dependencies,
    exports: {
      '.': './dist/index.js',
      ...(exportManifest ? { './package.json': './package.json' } : {}),
    },
  }))
  await writeFile(path.join(root, 'dist/index.js'), 'throw new Error("Dependency runtime must not execute during identity resolution")\n')
}

describe('shared Tailwind host dependency identity', () => {
  it.each([
    { name: 'without a hoisted shared package', rootSharedVersion: undefined },
    { name: 'with another shared version at root', rootSharedVersion: '9.9.9' },
  ])('reads shared from its converter consumer $name', async ({ rootSharedVersion }) => {
    const root = await mkdtemp(path.join(tmpdir(), 'tailwind-host-dependencies-'))
    try {
      const consumer = path.join(root, 'packages/tailwindcss')
      const tailwind = path.join(consumer, 'node_modules/weapp-tailwindcss')
      const postcssPlugin = path.join(tailwind, 'node_modules/@weapp-tailwindcss/postcss')
      const converter = path.join(postcssPlugin, 'node_modules/postcss-rule-unit-converter')
      const source = path.join(root, 'integrations/shared-hmr-tailwind/hostDependencies.mjs')
      await createInstalledPackage(consumer, '@weapp-vite/tailwindcss', '1.0.0', { 'weapp-tailwindcss': '1.0.0' })
      await createInstalledPackage(tailwind, 'weapp-tailwindcss', '1.0.0', { '@weapp-tailwindcss/postcss': '1.0.0' })
      await createInstalledPackage(postcssPlugin, '@weapp-tailwindcss/postcss', '1.0.0', { 'postcss-rule-unit-converter': '1.2.3' })
      await createInstalledPackage(converter, 'postcss-rule-unit-converter', '1.2.3', { 'postcss-plugin-shared': '2.3.4' })
      await createInstalledPackage(path.join(converter, 'node_modules/postcss-plugin-shared'), 'postcss-plugin-shared', '2.3.4')
      await createInstalledPackage(path.join(root, 'node_modules/postcss'), 'postcss', '8.0.0', {}, true)
      if (rootSharedVersion) {
        await createInstalledPackage(path.join(root, 'node_modules/postcss-plugin-shared'), 'postcss-plugin-shared', rootSharedVersion)
      }
      await mkdir(path.dirname(source), { recursive: true })
      await writeFile(source, await readFile(new URL('./hostDependencies.mjs', import.meta.url), 'utf8'))
      const isolated = await import(pathToFileURL(source).href) as {
        readHostDependencyOverrides: typeof readHostDependencyOverrides
      }
      const overrides = await isolated.readHostDependencyOverrides({ dependencies: { rolldown: '1.2.9' } })
      expect(overrides['postcss-plugin-shared']).toBe('2.3.4')
      expect(overrides).toEqual({
        'rolldown': '1.2.9',
        'postcss': '8.0.0',
        'postcss-rule-unit-converter': '1.2.3',
        'postcss-plugin-shared': '2.3.4',
      })
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('pins PostCSS plugins to the versions verified by the root consumer lock', async () => {
    const documents = parseLockDocuments(await readFile(new URL('../../pnpm-lock.yaml', import.meta.url), 'utf8'))
    expect(documents.flatMap(document => document.errors)).toEqual([])
    const packages = documents.flatMap((document) => {
      const lock = document.toJS() as { packages?: Record<string, unknown> }
      return Object.keys(lock.packages ?? {})
    })
    const overrides = await readHostDependencyOverrides({ dependencies: { rolldown: '1.2.9' } })
    for (const name of ['postcss-rule-unit-converter', 'postcss-plugin-shared'] as const) {
      const locked = packages.filter(key => key.startsWith(`${name}@`)).map(key => key.slice(name.length + 1))
      expect(locked).toHaveLength(1)
      expect(overrides[name]).toBe(locked[0])
    }
  })

  it('preserves compiler identity without changing release-age protection', async () => {
    const overrides = await readHostDependencyOverrides({ dependencies: { rolldown: '1.2.9' } })
    expect(overrides.rolldown).toBe('1.2.9')
    expect(overrides.postcss).toMatch(/^\d+\.\d+\.\d+$/)
    expect(Object.keys(overrides).sort()).toEqual(['postcss', 'postcss-plugin-shared', 'postcss-rule-unit-converter', 'rolldown'])
  })
})
