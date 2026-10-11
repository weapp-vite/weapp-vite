import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { extractConfigFromVue } from './vueConfig'

const extractMacro = vi.hoisted(() => vi.fn())
vi.mock('wevu/compiler', () => ({ extractJsonMacroFromScriptSetup: extractMacro }))

const roots: string[] = []
const macroSource = '<script setup>defineAppJson({ pages })</script>'

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
  vi.resetAllMocks()
})

async function fixture(source = macroSource) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vue-config-cache-'))
  roots.push(root)
  const file = path.join(root, 'app.vue')
  await fs.writeFile(file, source)
  return { root, file }
}

it('uses supplied and lazily read snapshots even when the physical source mtime is unchanged', async () => {
  const disk = '<template><view /></template><json>{ "pages": ["pages/disk/index"] }</json>'
  const snapshot = '<template><view /></template><json>{ "pages": ["pages/snapshot/index"] }</json>'
  const nextSnapshot = '<template><view /></template><json>{ "pages": ["pages/next/index"] }</json>'
  const { file } = await fixture(disk)
  const mtime = (await fs.stat(file)).mtimeMs
  expect(await extractConfigFromVue(file)).toEqual({ pages: ['pages/disk/index'] })
  expect(await extractConfigFromVue(file, { source: snapshot })).toEqual({ pages: ['pages/snapshot/index'] })
  const readSource = vi.fn(async () => nextSnapshot)
  expect(await extractConfigFromVue(file, { readSource })).toEqual({ pages: ['pages/next/index'] })
  expect(await extractConfigFromVue(file, { readSource })).toEqual({ pages: ['pages/next/index'] })
  expect(readSource).toHaveBeenCalledTimes(2)
  expect(await extractConfigFromVue(file, { readSource: async () => undefined })).toBeUndefined()
  expect(await extractConfigFromVue(file)).toEqual({ pages: ['pages/disk/index'] })
  expect((await fs.stat(file)).mtimeMs).toBe(mtime)
})

it('isolates both newly evaluated and cached config from caller mutations', async () => {
  const { file } = await fixture()
  const config = { pages: ['pages/home/index'], window: { navigationBarTitleText: '原配置' } }
  extractMacro.mockImplementation(async () => ({ config: structuredClone(config), dependencies: [] }))
  const first = await extractConfigFromVue(file)
  first!.pages.push('pages/derived/index')
  first!.window.navigationBarTitleText = '首次派生'
  const cached = await extractConfigFromVue(file)
  expect(cached).toEqual(config)
  cached!.pages.length = 0
  cached!.window.navigationBarTitleText = '缓存派生'
  expect(await extractConfigFromVue(file)).toEqual(config)
  expect(extractMacro).toHaveBeenCalledOnce()
})

it('re-evaluates unchanged source after its file is touched so untracked macro values can refresh', async () => {
  const { file } = await fixture()
  let externalValue = 'initial'
  extractMacro.mockImplementation(async () => ({ config: { externalValue }, dependencies: [] }))
  expect(await extractConfigFromVue(file, { source: macroSource })).toEqual({ externalValue: 'initial' })
  expect(await extractConfigFromVue(file, { source: macroSource })).toEqual({ externalValue: 'initial' })
  expect(extractMacro).toHaveBeenCalledOnce()

  externalValue = 'changed'
  const previous = await fs.stat(file)
  await fs.utimes(file, previous.atime, new Date(previous.mtimeMs + 2000))
  expect(await fs.readFile(file, 'utf8')).toBe(macroSource)
  expect(await extractConfigFromVue(file, { source: macroSource })).toEqual({ externalValue: 'changed' })
  expect(extractMacro).toHaveBeenCalledTimes(2)
})

it('keeps different lone surrogate code units distinct in supplied source identities', async () => {
  const { file } = await fixture('<template><view /></template>')
  const mtime = (await fs.stat(file)).mtimeMs
  for (const codeUnit of [0xD800, 0xD801]) {
    const title = String.fromCharCode(codeUnit)
    const source = `<template><view /></template><json>{ "title": "${title}" }</json>`
    expect(await extractConfigFromVue(file, { source })).toEqual({ title })
  }
  expect((await fs.stat(file)).mtimeMs).toBe(mtime)
})

it('re-evaluates a macro when an external dependency changes without changing the SFC', async () => {
  const { root, file } = await fixture()
  const dependency = path.join(root, 'pages.ts')
  await fs.writeFile(dependency, 'first')
  extractMacro.mockImplementation(async () => ({
    config: { revision: await fs.readFile(dependency, 'utf8') },
    dependencies: [dependency],
  }))
  expect(await extractConfigFromVue(file)).toEqual({ revision: 'first' })
  expect(await extractConfigFromVue(file)).toEqual({ revision: 'first' })
  const previous = await fs.stat(dependency)
  await fs.writeFile(dependency, 'second')
  await fs.utimes(dependency, previous.atime, new Date(previous.mtimeMs + 2000))
  expect(await extractConfigFromVue(file)).toEqual({ revision: 'second' })
  expect(extractMacro).toHaveBeenCalledTimes(2)
})

it('keeps forced app evaluation sensitive to untracked values and dependency contents with unchanged mtimes', async () => {
  const { root, file } = await fixture()
  const dependency = path.join(root, 'pages.ts')
  await fs.writeFile(dependency, 'first')
  const time = new Date('2024-01-01T00:00:00.000Z')
  await fs.utimes(dependency, time, time)
  let externalValue = 'initial'
  extractMacro.mockImplementation(async () => ({
    config: { revision: await fs.readFile(dependency, 'utf8'), externalValue },
    dependencies: [dependency],
  }))
  expect(await extractConfigFromVue(file, { source: macroSource, force: true })).toEqual({ revision: 'first', externalValue: 'initial' })
  externalValue = 'changed'
  await fs.writeFile(dependency, 'second')
  await fs.utimes(dependency, time, time)
  expect((await fs.stat(dependency)).mtimeMs).toBe(time.getTime())
  expect(await extractConfigFromVue(file, { source: macroSource, force: true })).toEqual({ revision: 'second', externalValue: 'changed' })
  expect(extractMacro).toHaveBeenCalledTimes(2)
})

it.each([false, true])('retries a failed macro after recovery (JSON fallback=%s)', async (withFallback) => {
  const { file } = await fixture(`${macroSource}${withFallback ? '<json>{ "window": { "navigationBarTitleText": "回退" } }</json>' : ''}`)
  extractMacro.mockRejectedValueOnce(new Error('dependency temporarily unavailable'))
    .mockResolvedValue({ config: { pages: ['pages/recovered/index'] }, dependencies: [] })
  expect(await extractConfigFromVue(file)).toEqual(withFallback ? { window: { navigationBarTitleText: '回退' } } : undefined)
  expect(await extractConfigFromVue(file)).toEqual({
    ...(withFallback ? { window: { navigationBarTitleText: '回退' } } : {}),
    pages: ['pages/recovered/index'],
  })
  expect(extractMacro).toHaveBeenCalledTimes(2)
})

it('preserves non-cloneable macro results without sharing them through the cache', async () => {
  const { file } = await fixture()
  const value = () => 'value'
  extractMacro.mockImplementation(async () => ({ config: { value }, dependencies: [] }))
  const first = await extractConfigFromVue(file)
  expect(first?.value).toBe(value)
  first!.value = 'mutated'
  expect((await extractConfigFromVue(file))?.value).toBe(value)
  expect(extractMacro).toHaveBeenCalledTimes(2)
})
