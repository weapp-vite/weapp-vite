import type { Plugin } from 'vite'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { afterEach, expect, it } from 'vitest'
import { evaluateStrict, extract, readInstalledVite } from '../../../../scripts/dependencyContracts/vite/helpers.mjs'
import { createSnapshotBuildConfig } from '../runtime/buildPlugin/snapshotConfig'
import { createOwnedPluginGeneration, markOwnedPlugin, markOwnedPlugins } from './ownedInstances'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

it('isolates owned plugin and hook containers while sharing API, metadata and closure state', () => {
  const api = {}
  const meta = Symbol('owned')
  const state = { calls: 0 }
  const result = Promise.resolve('same result')
  const hook = {
    order: 'pre' as const,
    filter: { id: /entry/ },
    handler(this: unknown, value: string) {
      expect((this as { expected: boolean }).expected).toBe(true)
      expect(value).toBe('input')
      state.calls++
      return result
    },
  }
  const source = markOwnedPlugin({ name: 'owned', api, [meta]: state, transform: hook })
  const first = createOwnedPluginGeneration()(source)
  const second = createOwnedPluginGeneration()(source)
  expect(first).not.toBe(source)
  expect(second).not.toBe(first)
  expect(first.transform).not.toBe(hook)
  expect(second.transform).not.toBe(first.transform)
  expect(first.transform.handler).not.toBe(hook.handler)
  expect(first.transform.handler).not.toBe(second.transform.handler)
  expect(first.transform.filter).toBe(hook.filter)
  expect(first.api).toBe(api)
  expect(first[meta]).toBe(state)
  expect(first.transform.handler.call({ expected: true }, 'input')).toBe(result)
  expect(second.transform.handler.call({ expected: true }, 'input')).toBe(result)
  expect(state.calls).toBe(2)
})

it.each(['shouldTransformCachedModule', 'closeServer', 'closePreviewServer'] as const)('isolates public %s hooks in function and object form', (name) => {
  const receiver = { owner: 'current-generation' }
  const input = { id: 'entry', reason: 'close' }
  const metadata = { owner: 'factory' }
  let calls = 0
  const handler = Object.assign(function (this: unknown, value: unknown) {
    expect(this).toBe(receiver)
    expect(value).toBe(input)
    calls++
  }, { metadata })
  for (const hook of [handler, { order: 'post' as const, handler }]) {
    const source = markOwnedPlugin({ name: 'owned-public-hooks', [name]: hook } satisfies Plugin)
    const first = createOwnedPluginGeneration()(source)[name] as typeof hook
    const second = createOwnedPluginGeneration()(source)[name] as typeof hook
    const firstHandler = typeof first === 'function' ? first : first.handler
    const secondHandler = typeof second === 'function' ? second : second.handler
    expect(first).not.toBe(hook)
    expect(second).not.toBe(first)
    expect(firstHandler).not.toBe(handler)
    expect(secondHandler).not.toBe(firstHandler)
    expect(firstHandler.metadata).toBe(metadata)
    if (typeof first !== 'function') {
      expect(first.order).toBe('post')
    }
    firstHandler.call(receiver, input)
    secondHandler.call(receiver, input)
  }
  expect(calls).toBe(4)
})

it('supports nested and promised owned factories without copying third-party plugin objects', async () => {
  const owned = markOwnedPlugin({ name: 'owned', buildStart() {} })
  const thirdParty = { name: 'third-party', transform: { handler: () => null } }
  const promised = markOwnedPlugins(Promise.resolve([{ name: 'async-owned', buildStart() {} }]))
  const input = [thirdParty, [owned, false], Promise.resolve([owned, thirdParty]), promised]
  const generation = createOwnedPluginGeneration()
  const copy = generation(input)
  expect(generation(input)).toBe(copy)
  expect(copy[0]).toBe(thirdParty)
  const nested = copy[1] as [typeof owned, false]
  expect(nested[0]).not.toBe(owned)
  expect(nested[1]).toBe(false)
  const resolved = await copy[2] as [typeof owned, typeof thirdParty]
  expect(resolved[0]).toBe(nested[0])
  expect(resolved[1]).toBe(thirdParty)
  const asyncOwned = await copy[3] as Plugin[]
  expect(asyncOwned[0]).not.toBe((await promised)[0])
  const unchanged = [thirdParty, false]
  expect(generation(unchanged)).toBe(unchanged)
  expect(thirdParty.transform.handler).toBe(unchanged[0] && (unchanged[0] as typeof thirdParty).transform.handler)
})

it('keeps installed Vite hook metadata broadcasts within the owning generation', async () => {
  const { source } = await readInstalledVite()
  const fragment = extract(source, 'const wrappedHookMap =', '\nfunction wrapEnvironmentResolveId')
  const { wrap } = evaluateStrict(`${fragment}\nglobalThis.wrap = wrapHookObject;`, { WeakRef })
  const owned = markOwnedPlugin({ name: 'owned', transform: { order: 'pre', filter: { id: /entry/ }, handler: () => null } } satisfies Plugin)
  const first = createOwnedPluginGeneration()(owned)
  const second = createOwnedPluginGeneration()(owned)
  const firstWrappers = [wrap(first.transform, first.transform.handler), wrap(first.transform, first.transform.handler)]
  const secondWrapper = wrap(second.transform, second.transform.handler)
  const filter = { id: /next/ }
  Reflect.set(first.transform, 'order', 'post')
  first.transform.filter = filter
  expect(firstWrappers.map(item => item.order)).toEqual(['post', 'post'])
  expect(firstWrappers.map(item => item.filter)).toEqual([filter, filter])
  expect(secondWrapper.order).toBe('pre')
  expect(secondWrapper.filter).toBe(owned.transform.filter)
  expect(Object.getOwnPropertyDescriptor(owned.transform, 'order')).toEqual({ value: 'pre', writable: true, enumerable: true, configurable: true })
  const thirdParty = { name: 'third-party', transform: { order: 'pre', handler: () => null } } satisfies Plugin
  const thirdPartyFirst = createOwnedPluginGeneration()(thirdParty)
  const thirdPartySecond = createOwnedPluginGeneration()(thirdParty)
  expect(thirdPartyFirst).toBe(thirdParty)
  expect(thirdPartySecond).toBe(thirdParty)
  const thirdPartyWrappers = [wrap(thirdPartyFirst.transform, thirdParty.transform.handler), wrap(thirdPartySecond.transform, thirdParty.transform.handler)]
  Reflect.set(thirdParty.transform, 'order', 'post')
  expect(thirdPartyWrappers.map(item => item.order)).toEqual(['post', 'post'])
})

it('preserves filter, ordering and hook context through real Vite builds across generations', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'owned-plugin-generation-'))
  roots.push(root)
  const entry = path.join(root, 'owned-entry.js')
  await writeFile(entry, 'import "virtual:ignored.skip"; export const value = "before-owned"')
  const seen: string[] = []
  const plugin = markOwnedPlugin({
    name: 'owned-real-build',
    resolveId(id) {
      if (id.startsWith('virtual:')) {
        return `\0${id.slice('virtual:'.length)}`
      }
    },
    load(id) {
      if (id === '\0ignored.skip') {
        return 'console.log("ignored")'
      }
    },
    transform: {
      order: 'pre',
      filter: { id: /owned-entry\.js$/ },
      handler(code, id) {
        expect(id.endsWith('/owned-entry.js')).toBe(true)
        expect(this.environment.name).toBe('client')
        expect(this.meta.viteVersion).toBeTypeOf('string')
        seen.push('owned')
        return code.replace('before-owned', 'after-owned')
      },
    },
  } satisfies Plugin)
  const thirdParty: Plugin = {
    name: 'third-party-real-build',
    transform: {
      order: 'post',
      handler(code, id) {
        if (id.endsWith('/owned-entry.js')) {
          expect(code).toContain('after-owned')
          seen.push('third-party')
        }
      },
    },
  }
  const options = {
    root,
    configFile: false as const,
    envDir: false as const,
    logLevel: 'silent' as const,
    plugins: [thirdParty, plugin],
    build: { write: false, minify: false, lib: { entry, formats: ['es' as const], fileName: 'entry' } },
  }
  for (let iteration = 0; iteration < 2; iteration++) {
    const input = createSnapshotBuildConfig(options)
    expect(input.plugins![0]).toBe(thirdParty)
    expect(input.plugins![1]).not.toBe(plugin)
    const result = await build(input)
    const outputs = Array.isArray(result) ? result : [result]
    if (!outputs.every(output => 'output' in output)) {
      throw new Error('Expected finite build outputs')
    }
    expect(outputs.flatMap(output => output.output).some(item => item.type === 'chunk' && item.code.includes('after-owned'))).toBe(true)
  }
  expect(seen).toEqual(['owned', 'third-party', 'owned', 'third-party'])
  expect(Object.getOwnPropertyDescriptor(plugin.transform, 'order')?.value).toBe('pre')
})
