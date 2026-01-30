import path from 'node:path'
import { expect, it } from 'vitest'
import { bundleRequire, loadFromBundledFile } from '@/index'

const normalize = (filePath: string) => filePath.replaceAll('\\', '/')

it('externalizes hoisted deps but bundles nested node_modules', async () => {
  const fixtureDir = path.join(__dirname, './fixture/externalize-paths')
  const relativeEntry = path.relative(process.cwd(), path.join(fixtureDir, 'input.ts'))

  const { mod, dependencies } = await bundleRequire({
    filepath: relativeEntry,
  })

  const normalizedDeps = dependencies.map(normalize)
  const inlineModulePath = normalize(
    path.join(fixtureDir, 'sub/node_modules/inline-pkg/index.mjs'),
  )
  const hoistedModulePath = normalize(
    path.join(fixtureDir, 'node_modules/hoisted-pkg/index.mjs'),
  )

  expect(mod.inline).toBe('inline:nested')
  expect(mod.hoisted).toBe('hoisted:root')
  expect(normalizedDeps).toContain(inlineModulePath)
  expect(normalizedDeps).not.toContain(hoistedModulePath)
})

it('loads cjs bundles through the require loader when no cwd is provided', async () => {
  const fixtureDir = path.join(__dirname, './fixture/cjs-loader')
  const entryPath = path.join(fixtureDir, 'entry.cjs')
  const bundledCode = [
    'const side = require("./side-effect.cjs")',
    'module.exports = { label: "cjs-runtime", side }',
  ].join('\n')

  const mod = await loadFromBundledFile(
    entryPath,
    bundledCode,
    {
      isESM: false,
      format: 'cjs',
    } as any,
  )

  expect(mod.label).toBe('cjs-runtime')
  expect(mod.side.fromSide).toBe('side-value')
})

it('keeps JSON imports bundled (not externalized)', async () => {
  const fixtureDir = path.join(__dirname, './fixture/json-import')
  const entryPath = path.join(fixtureDir, 'input.ts')
  const { mod, dependencies } = await bundleRequire({
    filepath: entryPath,
    cwd: fixtureDir,
  })

  expect(mod.value).toBe('json-value')
  const normalizedDeps = dependencies.map(normalize)
  expect(normalizedDeps).toContain(normalize(path.join(fixtureDir, 'data.json')))
})

it('externalizes node builtins', async () => {
  const fixtureDir = path.join(__dirname, './fixture/builtin-import')
  const entryPath = path.join(fixtureDir, 'input.ts')
  const { mod, dependencies } = await bundleRequire({
    filepath: entryPath,
    cwd: fixtureDir,
  })

  expect(mod.hasFs).toBe(true)
  const normalizedDeps = dependencies.map(normalize)
  expect(normalizedDeps.some(dep => dep.includes('node:fs'))).toBe(false)
})
