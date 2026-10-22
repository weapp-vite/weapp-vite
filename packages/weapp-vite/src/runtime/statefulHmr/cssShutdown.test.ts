import type { Plugin, PluginContext } from 'rolldown'
import { expect, it, vi } from 'vitest'
import { bindStatefulCssShutdown } from './cssShutdown'

function handler<T extends (...args: never[]) => unknown>(hook: T | { handler: T } | undefined) {
  return typeof hook === 'function' ? hook : hook?.handler
}

it('releases a CSS compiler reopened after buildEnd at the same engine terminal boundary', async () => {
  const context = {} as PluginContext
  let compilerActive = true
  const buildEnd = vi.fn(function (this: PluginContext) {
    expect(this).toBe(context)
    compilerActive = false
  })
  const original: Plugin = { name: 'vite:css', buildEnd }
  const bound = await bindStatefulCssShutdown(original) as Plugin
  await handler(bound.buildEnd)!.call(context)
  expect(compilerActive).toBe(false)
  compilerActive = true
  await handler(bound.closeBundle)!.call(context)
  expect(compilerActive).toBe(false)
  await handler(bound.closeBundle)!.call(context)
  expect(compilerActive).toBe(false)
  expect(original.closeBundle).toBeUndefined()
  expect(bound.buildEnd).toBe(original.buildEnd)
})

it('preserves existing close failures while still releasing CSS and retains a cleanup error', async () => {
  const original = new Error('native close failed')
  const cleanup = new Error('CSS release failed')
  const buildEnd = vi.fn(() => {
    throw cleanup
  })
  const closeBundle = vi.fn(() => {
    throw original
  })
  const bound = await bindStatefulCssShutdown({ name: 'vite:css', buildEnd: { handler: buildEnd }, closeBundle: { handler: closeBundle } }) as Plugin
  const error = new Error('engine failed')
  await expect(handler(bound.closeBundle)!.call({} as PluginContext, error)).rejects.toMatchObject({ errors: [original, cleanup], cause: original })
  expect(closeBundle).toHaveBeenCalledWith(error)
  expect(buildEnd).toHaveBeenCalledWith(error)
})

it('binds only the owning CSS plugin through promised and nested plugin options', async () => {
  const foreign: Plugin = { name: 'other-css', buildEnd: vi.fn() }
  const css: Plugin = { name: 'vite:css', buildEnd: vi.fn() }
  const options = await bindStatefulCssShutdown(Promise.resolve([foreign, [Promise.resolve(css)], false])) as Plugin[]
  expect(options[0]).toBe(foreign)
  expect((options[1] as unknown as Plugin[])[0].closeBundle).toBeDefined()
  expect(options[2]).toBe(false)
  expect(css.closeBundle).toBeUndefined()
})

it('releases a reopened pool before the next buildStart replaces its native closure', async () => {
  const context = {} as PluginContext
  const pools: { active: boolean }[] = []
  let current: { active: boolean } | undefined
  const buildStart = vi.fn(function (this: PluginContext) {
    expect(this).toBe(context)
    current = { active: false }
    pools.push(current)
  })
  const buildEnd = vi.fn(function (this: PluginContext) {
    expect(this).toBe(context)
    if (current) {
      current.active = false
    }
  })
  const original: Plugin = { name: 'vite:css', buildStart: { order: 'pre', handler: buildStart }, buildEnd }
  const bound = await bindStatefulCssShutdown(original) as Plugin
  await handler(bound.buildStart)!.call(context, {} as never)
  await handler(bound.buildEnd)!.call(context)
  pools[0]!.active = true
  await handler(bound.buildStart)!.call(context, {} as never)
  pools[1]!.active = true
  await handler(bound.closeBundle)!.call(context)
  expect(pools).toEqual([{ active: false }, { active: false }])
  expect(bound.buildStart).toMatchObject({ order: 'pre', sequential: true })
  expect(original.buildStart).toEqual({ order: 'pre', handler: buildStart })
  expect(buildStart).toHaveBeenCalledTimes(2)
})

it('retains a previous pool release failure and refuses to replace the unreleased pool', async () => {
  const failure = new Error('previous CSS pool could not close')
  const buildStart = vi.fn()
  const bound = await bindStatefulCssShutdown({
    name: 'vite:css',
    buildStart,
    buildEnd() {
      throw failure
    },
  }) as Plugin
  await expect(handler(bound.buildStart)!.call({} as PluginContext, {} as never)).rejects.toBe(failure)
  expect(buildStart).not.toHaveBeenCalled()
})
