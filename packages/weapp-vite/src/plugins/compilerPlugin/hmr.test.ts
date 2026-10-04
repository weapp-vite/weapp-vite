import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { resolveRealpath, withRealpathScope } from '../../utils/realpathScope'
import { CompilerHmrHost, compilerSourceId } from './hmr'

const roots: string[] = []

function sourceFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'compiler-source-identity-'))
  roots.push(root)
  return root
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

it('shares physical source identity with entry resolution only within a synchronous operation', () => {
  const file = path.join(sourceFixture(), 'page.ts')
  writeFileSync(file, 'Page({})')
  const native = vi.spyOn(realpathSync, 'native')
  withRealpathScope(() => {
    const entrySource = resolveRealpath(file).replaceAll('\\', '/')
    expect(compilerSourceId(file)).toBe(entrySource)
    expect(native).toHaveBeenCalledTimes(1)
  })
  compilerSourceId(file)
  expect(native).toHaveBeenCalledTimes(2)
})

it('observes junction retargeting between source identity operations', () => {
  const root = sourceFixture()
  const first = path.join(root, 'first')
  const second = path.join(root, 'second')
  const alias = path.join(root, 'alias')
  for (const directory of [first, second]) {
    mkdirSync(directory)
    writeFileSync(path.join(directory, 'page.ts'), 'Page({})')
  }
  symlinkSync(first, alias, 'junction')
  const read = () => withRealpathScope(() => compilerSourceId(path.join(alias, 'page.ts')))
  expect(read()).toBe(compilerSourceId(path.join(first, 'page.ts')))
  unlinkSync(alias)
  symlinkSync(second, alias, 'junction')
  expect(read()).toBe(compilerSourceId(path.join(second, 'page.ts')))
})

it('resolves deleted sources through their parent without caching the missing file', () => {
  const root = sourceFixture()
  const file = path.join(root, 'page.ts')
  const parent = realpathSync.native(root)
  withRealpathScope(() => {
    expect(compilerSourceId(file)).toBe(path.join(parent, 'page.ts').replaceAll('\\', '/'))
    writeFileSync(file, 'Page({})')
    expect(compilerSourceId(file)).toBe(realpathSync.native(file).replaceAll('\\', '/'))
  })
})

it('isolates input revisions and retains deleted sources for providers', async () => {
  const host = new CompilerHmrHost()
  const transform = vi.fn(async () => ({ assets: [{ fileName: 'app.wxss', code: 'first' }] }))
  host.register('fake-provider', transform)
  host.capture('page.ts', 'first')
  const first = host.freeze(['page.ts'])
  host.capture('page.ts', null)
  const second = host.freeze(['page.ts'])
  await host.prepare(first)
  expect(transform).toHaveBeenCalledWith(first)
  expect([...first.sources.values()]).toEqual(['first'])
  expect([...second.sources.values()]).toEqual([null])
  expect(second.revision).toBeGreaterThan(first.revision)
})

it('rejects legacy content providers instead of publishing an untransformed patch', async () => {
  const host = new CompilerHmrHost()
  host.register('legacy')
  await expect(host.prepare(host.freeze([]))).rejects.toThrow('legacy')
})

it('preserves foreign Windows absolute identities instead of rebasing them onto the local workspace', () => {
  expect(compilerSourceId('C:\\project\\page.ts')).toBe('C:/project/page.ts')
})

it('classifies the pinned batch against the previous batch, not intermediate source captures', () => {
  const host = new CompilerHmrHost()
  const source = (value: string) => `<script setup>const value = '${value}'</script>\n<template><view>{{ value }}</view></template>`
  host.captureNative('page.vue', source('first'))
  host.setNativeSources(['page.vue'])
  host.capture('page.vue', source('second').replaceAll('\n', '\r\n'))
  host.captureNative('page.vue', source('second'))
  const input = host.freeze(['page.vue'])
  host.captureNative('page.vue', `${source('third')}<style>.probe { color: red; }</style>`)
  expect(host.hasVisualChanges(['page.vue'], input)).toBe(false)
})
