import type { MutableCompilerContext } from '../../context'
import type { VueStaticConfigFacts } from './vueConfig'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parse } from 'vue/compiler-sfc'
import { extractConfigFromVue } from './vueConfig'

const extractMacro = vi.hoisted(() => vi.fn())

vi.mock('vue/compiler-sfc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue/compiler-sfc')>()
  return { ...actual, parse: vi.fn(actual.parse) }
})
vi.mock('wevu/compiler', () => ({ extractJsonMacroFromScriptSetup: extractMacro }))

function source(title: string) {
  return `<template><view /></template><json>{"navigationBarTitleText":"${title}","usingComponents":{"card":"/components/card"}}</json>`
}

describe('static Vue config facts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reuses static parsing across contexts and returns independent mutable config values', async () => {
    const cache = new Map<string, VueStaticConfigFacts>()
    const input = source('shared')
    const context = () => ({ configService: {} }) as unknown as MutableCompilerContext
    const first = await extractConfigFromVue('page.vue', { source: input, compilerContext: context(), staticConfigCache: cache })
    first!.usingComponents.card = '/modified'
    const second = await extractConfigFromVue('page.vue', { source: input, compilerContext: context(), staticConfigCache: cache })
    expect(second!.usingComponents.card).toBe('/components/card')
    expect(first).not.toBe(second)
    expect(Object.isFrozen(cache.get('page.vue')!.config!.usingComponents)).toBe(true)
    expect(parse).toHaveBeenCalledTimes(1)
  })

  it('validates the current input before reuse and retires deleted or unreadable facts', async () => {
    const cache = new Map<string, VueStaticConfigFacts>()
    const read = async (input: string) => await extractConfigFromVue('page.vue', { source: source(input), staticConfigCache: cache })
    expect((await read('first'))!.navigationBarTitleText).toBe('first')
    expect((await read('changed'))!.navigationBarTitleText).toBe('changed')
    expect(await extractConfigFromVue('page.vue', { readSource: async () => undefined, staticConfigCache: cache })).toBeUndefined()
    expect(cache.size).toBe(0)
    await read('changed')
    expect(parse).toHaveBeenCalledTimes(3)
    expect(await extractConfigFromVue('page.vue', {
      readSource: async () => { throw new Error('unreadable source') },
      staticConfigCache: cache,
    })).toBeUndefined()
    expect(cache.size).toBe(0)
  })

  it('shares compiler-proven static macro facts but keeps derived mutations local', async () => {
    const cache = new Map<string, VueStaticConfigFacts>()
    const input = '<script setup>definePageJson({ navigationBarTitleText: "literal", usingComponents: { card: "/declared" } })</script>'
    extractMacro.mockResolvedValue({ config: { navigationBarTitleText: 'literal', usingComponents: { card: '/declared' } }, isStatic: true })
    const first = await extractConfigFromVue('page.vue', { source: input, staticConfigCache: cache })
    first!.usingComponents.card = '/derived/first-generation'
    const second = await extractConfigFromVue('page.vue', { source: input, staticConfigCache: cache })
    expect(second).toEqual({ navigationBarTitleText: 'literal', usingComponents: { card: '/declared' } })
    expect(first).not.toBe(second)
    expect(Object.isFrozen(cache.get('page.vue')!.config!.usingComponents)).toBe(true)
    expect(extractMacro).toHaveBeenCalledTimes(1)
    expect(parse).toHaveBeenCalledTimes(1)
    await extractConfigFromVue('page.vue', { source: input, staticConfigCache: cache, force: true })
    expect(extractMacro).toHaveBeenCalledTimes(2)
  })

  it('reevaluates dynamic JSON macros even when they have no file dependencies', async () => {
    const cache = new Map<string, VueStaticConfigFacts>()
    const input = '<script setup>definePageJson({ navigationBarTitleText: process.env.TITLE })</script>'
    extractMacro.mockResolvedValueOnce({ config: { navigationBarTitleText: 'first' }, dependencies: [] })
    extractMacro.mockResolvedValueOnce({ config: { navigationBarTitleText: 'next' }, dependencies: [] })
    expect(await extractConfigFromVue('page.vue', { source: input, staticConfigCache: cache })).toEqual({ navigationBarTitleText: 'first' })
    expect(await extractConfigFromVue('page.vue', { source: input, staticConfigCache: cache })).toEqual({ navigationBarTitleText: 'next' })
    expect(cache.size).toBe(0)
    expect(extractMacro).toHaveBeenCalledTimes(2)
    expect(parse).toHaveBeenCalledTimes(2)
  })

  it('replaces static facts when literal input changes or extraction fails', async () => {
    const cache = new Map<string, VueStaticConfigFacts>()
    const first = '<script setup>definePageJson({ title: "first" })</script>'
    const changed = '<script setup>definePageJson({ title: "changed" })</script>'
    extractMacro.mockResolvedValueOnce({ config: { title: 'first' }, isStatic: true })
    extractMacro.mockRejectedValueOnce(new Error('parse failure'))
    extractMacro.mockResolvedValueOnce({ config: { title: 'changed' }, isStatic: true })
    expect(await extractConfigFromVue('page.vue', { source: first, staticConfigCache: cache })).toEqual({ title: 'first' })
    expect(await extractConfigFromVue('page.vue', { source: changed, staticConfigCache: cache })).toBeUndefined()
    expect(cache.size).toBe(0)
    expect(await extractConfigFromVue('page.vue', { source: changed, staticConfigCache: cache })).toEqual({ title: 'changed' })
    expect(extractMacro).toHaveBeenCalledTimes(3)
  })

  it('does not cache failed JSON composition even when its macro is static', async () => {
    const cache = new Map<string, VueStaticConfigFacts>()
    const input = '<script setup>definePageJson({ title: "literal" })</script><json>{ invalid }</json>'
    extractMacro.mockResolvedValue({ config: { title: 'literal' }, isStatic: true })
    expect(await extractConfigFromVue('page.vue', { source: input, staticConfigCache: cache })).toEqual({ title: 'literal' })
    expect(await extractConfigFromVue('page.vue', { source: input, staticConfigCache: cache })).toEqual({ title: 'literal' })
    expect(cache.size).toBe(0)
    expect(extractMacro).toHaveBeenCalledTimes(2)
  })

  it.each([
    '<template><view></template>',
    '<template><view /></template><json>{ invalid json }</json>',
  ])('does not cache failed or partial parsing: %s', async (input) => {
    const cache = new Map<string, VueStaticConfigFacts>()
    await extractConfigFromVue('page.vue', { source: input, staticConfigCache: cache })
    await extractConfigFromVue('page.vue', { source: input, staticConfigCache: cache })
    expect(cache.size).toBe(0)
    expect(parse).toHaveBeenCalledTimes(2)
  })

  it('caches a successful absence of config and respects force', async () => {
    const cache = new Map<string, VueStaticConfigFacts>()
    const options = { source: '<template><view /></template>', staticConfigCache: cache }
    expect(await extractConfigFromVue('page.vue', options)).toBeUndefined()
    expect(await extractConfigFromVue('page.vue', options)).toBeUndefined()
    expect(parse).toHaveBeenCalledTimes(1)
    expect(await extractConfigFromVue('page.vue', { ...options, force: true })).toBeUndefined()
    expect(parse).toHaveBeenCalledTimes(2)
  })
})
