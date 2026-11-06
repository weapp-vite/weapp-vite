import path from 'pathe'
import { expect, it, vi } from 'vitest'
import { createModuleGraphService } from '../../moduleGraph'
import { recordSfcBlockSource } from '../../plugins/utils/sfcTemplateDependencies'
import { withCompilerSourceSnapshot } from '../../plugins/utils/sourceSnapshot'
import { createSfcResolveSrcOptions } from '../../plugins/utils/vueSfc'
import { createRuntimeState } from '../runtimeState'
import { captureEntryTopology, entryTopologySignature, hasEntryTopologyChange } from './entryTopology'
import { resolveVueEntryTopologySignature } from './vueEntryTopology'

it('compares entry references independently from presentation fields and key ordering', () => {
  const before = { usingComponents: { a: '/a', b: '/b' }, navigationBarTitleText: 'before' }
  const after = { navigationBarTitleText: 'after', usingComponents: { b: '/b', a: '/a' } }
  expect(entryTopologySignature(before)).toBe(entryTopologySignature(after))
  for (const changed of [{ usingComponents: { a: '/a' } }, {}, { pages: ['home', 'other'] }, { componentGenerics: { card: { default: '/new' } } }]) {
    expect(entryTopologySignature(changed)).not.toBe(entryTopologySignature(before))
  }
})

it('compares the previously compiled JSON before reading its new value', async () => {
  const cache = new Map([['page.json', { usingComponents: { card: '/card' } }]])
  const ctx = {
    jsonService: {
      cache,
      read: async (file: string) => {
        cache.delete(file)
        return {}
      },
    },
  } as any
  expect(await hasEntryTopologyChange(ctx, ['page.json'])).toBe(true)
  expect(await hasEntryTopologyChange(ctx, ['page.json'])).toBe(false)
})

it('does not parse external JSON dependencies as mini-program entry configuration', async () => {
  const read = vi.fn(async () => ({ usingComponents: { external: '/unrelated' } }))
  const ctx = { jsonService: { cache: new Map(), read } } as any
  expect(await hasEntryTopologyChange(ctx, ['transform-rules.json', 'data.json.ts'])).toBe(false)
  expect(read).not.toHaveBeenCalled()
})

it('compares a confirmed config deletion without reading it as malformed JSON', async () => {
  const file = '/project/pages/home.json'
  const read = vi.fn()
  const ctx = { jsonService: { cache: new Map([[file, { usingComponents: { card: '/card' } }]]), read } } as any
  expect(await hasEntryTopologyChange(ctx, [file], undefined, new Set([file]))).toBe(true)
  expect(read).not.toHaveBeenCalled()
})

it('detects the first configuration added to a previously compiled native entry', async () => {
  const read = vi.fn(async () => ({ usingComponents: { card: '/card' } }))
  const ctx = {
    jsonService: { cache: new Map(), read },
    runtimeState: { build: { hmr: { entriesMap: new Map([
      ['/project/pages/home.ts', { path: '/project/pages/home.ts', type: 'page' }],
    ]) } } },
  } as any
  expect(await hasEntryTopologyChange(ctx, ['/project/pages/home.json.ts'])).toBe(true)
  expect(read).toHaveBeenCalledWith('/project/pages/home.json.ts')
})

it('retains the compiled topology baseline after its JSON cache entry is evicted', async () => {
  const ctx = {
    jsonService: { cache: new Map(), read: async () => undefined },
    runtimeState: { build: { hmr: { entriesMap: new Map([
      ['/project/pages/home.ts', {
        path: '/project/pages/home.ts',
        type: 'page',
        jsonPath: '/project/pages/home.json',
        declaredJson: { usingComponents: { card: '/card' } },
      }],
    ]) } } },
  } as any
  expect(await hasEntryTopologyChange(ctx, ['/project/pages/home.json'])).toBe(true)
})

it('compares against the committed complete scan when an earlier metadata build reads newer JSON', async () => {
  const file = '/project/pages/home.json'
  const entry = {
    path: '/project/pages/home.ts',
    jsonPath: file,
    declaredJson: { usingComponents: { card: '/card' } },
  }
  const cache = new Map<string, unknown>([[file, entry.declaredJson]])
  const ctx = {
    jsonService: { cache, read: async () => ({}) },
    runtimeState: { build: { hmr: { entriesMap: new Map([['pages/home', entry]]) } } },
  } as any
  const committed = captureEntryTopology(ctx)
  // WXML 的局部快照可先更新入口 JSON 与共享解析缓存，但还没有重新扫描可达组件。
  entry.declaredJson = {} as typeof entry.declaredJson
  cache.set(file, {})
  expect(await hasEntryTopologyChange(ctx, [file], committed)).toBe(true)
  expect(await hasEntryTopologyChange(ctx, [file], captureEntryTopology(ctx))).toBe(false)
})

it('compares changed Vue component references with the committed scan using the frozen prepared input', async () => {
  const file = path.resolve('entry-topology-fixture/page.vue')
  const retired = path.resolve('entry-topology-fixture/retired.vue')
  const before = '<script setup>import Card from "./card.vue"; const marker = "before"</script><template><Card /><view>{{ marker }}</view></template>'
  const after = '<script setup>const marker = "after"</script><template><view>{{ marker }}</view></template>'
  const configService = { platform: 'weapp', weappViteConfig: {} } as any
  const runtimeState = createRuntimeState()
  runtimeState.build.hmr.resolvedEntryMap.set(file, { id: file })
  resolveVueEntryTopologySignature(configService, file, before)
  resolveVueEntryTopologySignature(configService, retired, before)
  const ctx = { configService, runtimeState } as any
  const committed = captureEntryTopology(ctx)
  expect(committed.has(retired)).toBe(false)
  expect(await hasEntryTopologyChange(ctx, [retired], committed, new Set([retired]))).toBe(false)
  await withCompilerSourceSnapshot(configService, new Map([[file, after]]), async () => {
    expect(await hasEntryTopologyChange(ctx, [file], committed)).toBe(true)
    // 失败或局部构建更新了分析缓存，也不能推进完整扫描的已提交基线。
    expect(await hasEntryTopologyChange(ctx, [file], committed)).toBe(true)
  })
  await withCompilerSourceSnapshot(configService, new Map([[file, before.replace('before', 'new marker')]]), async () => {
    expect(await hasEntryTopologyChange(ctx, [file], committed)).toBe(false)
  })
  expect(await hasEntryTopologyChange(ctx, [file], committed, new Set([file]))).toBe(true)
})

it('rescans only registered external script or template block inputs while leaving other owner dependencies incremental', async () => {
  const owner = path.resolve('entry-topology-fixture/page.vue')
  const script = path.resolve('entry-topology-fixture/logic.ts')
  const template = path.resolve('entry-topology-fixture/page.html')
  const props = path.resolve('entry-topology-fixture/props.ts')
  const style = path.resolve('entry-topology-fixture/page.css')
  const unrelated = path.resolve('entry-topology-fixture/unrelated.html')
  const configService = { platform: 'weapp', weappViteConfig: {} } as any
  resolveVueEntryTopologySignature(configService, owner, '<script src="./logic.ts"></script><template src="./page.html"></template>')
  recordSfcBlockSource({}, './logic.ts', owner, script, configService)
  recordSfcBlockSource({}, './page.html', owner, template, configService)
  const resolve = vi.fn()
  const graph = {
    collectAffectedEntries: (file: string, kind: string) => new Set(
      (kind === 'script' && [script, props].includes(file)) || (kind === 'template' && file === template) ? [owner] : [],
    ),
    resolve,
  }
  const runtimeState = createRuntimeState()
  runtimeState.build.hmr.resolvedEntryMap.set(owner, { id: owner })
  const ctx = { configService, moduleGraphService: graph, runtimeState } as any

  expect(await hasEntryTopologyChange(ctx, [script])).toBe(true)
  expect(await hasEntryTopologyChange(ctx, [template])).toBe(true)
  expect(await hasEntryTopologyChange(ctx, [props, style, unrelated])).toBe(false)
  expect(resolve).not.toHaveBeenCalled()
  runtimeState.build.hmr.resolvedEntryMap.clear()
  expect(await hasEntryTopologyChange(ctx, [script, template])).toBe(false)
})

it('rescans a registered alias block when it resolves to the changed input or its prior target was removed', async () => {
  const owner = path.resolve('entry-topology-fixture/alias.vue')
  const template = path.resolve('external-topology-fixture/page.html')
  const configService = { platform: 'weapp', weappViteConfig: {} } as any
  resolveVueEntryTopologySignature(configService, owner, '<template src="@templates/page.html"></template>')
  recordSfcBlockSource({}, '@templates/page.html', owner, template, configService)
  const resolve = vi.fn()
  const ctx = {
    configService,
    moduleGraphService: { collectAffectedEntries: () => new Set([owner]), resolve },
  } as any
  expect(await hasEntryTopologyChange(ctx, [template])).toBe(true)
  expect(await hasEntryTopologyChange(ctx, [template], undefined, new Set([template]))).toBe(true)
  expect(resolve).not.toHaveBeenCalled()
})

it('uses hook-owned block identities between snapshots without resolving transitive template content', async () => {
  const owner = path.resolve('entry-topology-fixture/external.vue')
  const template = path.resolve('entry-topology-fixture/body.wxml')
  const shared = path.resolve('entry-topology-fixture/shared/card.wxml')
  const configService = { isDev: true, weappViteConfig: {} } as any
  resolveVueEntryTopologySignature(configService, owner, '<template src="@templates/body"></template>')
  const options = createSfcResolveSrcOptions({ resolve: async () => ({ id: template }) }, configService)
  await options.resolveId!('@templates/body', owner)
  const graph = createModuleGraphService()
  graph.replaceEntryDependencies(owner, 'template', [template, shared])
  const runtimeState = createRuntimeState()
  runtimeState.build.hmr.resolvedEntryMap.set(owner, { id: owner })
  const ctx = { configService, moduleGraphService: graph, runtimeState } as any
  await expect(graph.resolve('@templates/body', owner)).rejects.toThrow('尚未绑定')
  expect(await hasEntryTopologyChange(ctx, [shared])).toBe(false)
  expect(await hasEntryTopologyChange(ctx, [template])).toBe(true)
})

it('conservatively rescans an affected external owner after resolution facts are missing or invalidated', async () => {
  const owner = path.resolve('entry-topology-fixture/configured.vue')
  const template = path.resolve('entry-topology-fixture/body.wxml')
  const shared = path.resolve('entry-topology-fixture/shared/card.wxml')
  const configService = { options: {}, isDev: true, weappViteConfig: {} } as any
  resolveVueEntryTopologySignature(configService, owner, '<template src="@templates/body"></template>')
  const graph = createModuleGraphService()
  graph.replaceEntryDependencies(owner, 'template', [template, shared])
  const ctx = { configService, moduleGraphService: graph } as any
  expect(await hasEntryTopologyChange(ctx, [shared])).toBe(true)
  recordSfcBlockSource({}, '@templates/body', owner, template, configService)
  expect(await hasEntryTopologyChange(ctx, [shared])).toBe(false)
  recordSfcBlockSource({}, '@templates/body', owner, undefined, configService)
  expect(await hasEntryTopologyChange(ctx, [shared])).toBe(true)
  recordSfcBlockSource({}, '@templates/body', owner, template, configService)
  configService.options = {}
  expect(await hasEntryTopologyChange(ctx, [shared])).toBe(true)
})
