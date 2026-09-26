import { expect, it, vi } from 'vitest'
import { CompilerHmrHost, compilerSourceId } from './hmr'

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
