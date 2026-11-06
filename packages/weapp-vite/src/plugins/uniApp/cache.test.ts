import type { CompilerContext } from '../../context'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { transformUniAppSource } from 'wevu/compiler'
import { attachHmrRuntimeSession, getHmrRuntimeSession } from '../../runtime/hmrRuntimeSession'
import { compilerSourceId } from '../compilerPlugin/hmr'
import { transformUniAppCompatibilitySource, uniAppCompatibility, UniAppCompatibilityTransformError } from '../uniApp'
import { withCompilerSourceSnapshot } from '../utils/sourceSnapshot'
import { readVueLikeCompilerInput } from '../vue/transform/sourceInput'
import { clearUniAppCompatibilitySession, getUniAppCompatibilitySessionStats, UniAppCompatibilityCache } from './cache'

vi.mock('wevu/compiler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wevu/compiler')>()
  return { ...actual, transformUniAppSource: vi.fn(actual.transformUniAppSource) }
})

function createContext(sourceConfig: object = {}, overrides: Record<string, unknown> = {}) {
  return {
    configService: {
      absoluteSrcRoot: path.resolve('fixture-project/src'),
      platform: 'weapp',
      options: { sourceConfig },
      weappViteConfig: { uniApp: { include: ['fixture-ui'] } },
      ...overrides,
    },
  } as unknown as CompilerContext
}

const source = '<script setup>import { ref } from "vue"\nconst title = ref("original")</script><template><view>{{ title }}</view></template>'

beforeEach(() => {
  vi.mocked(transformUniAppSource).mockClear()
})

describe('uni-app compatibility pure result cache', () => {
  it('reads each generation before reusing unchanged, modified and restored content', async () => {
    const ctx = createContext()
    const filename = path.join(ctx.configService.absoluteSrcRoot, 'Page.vue')
    const plugin = uniAppCompatibility(ctx)[0]
    const transform = plugin.transform as (code: string, id: string) => { code: string }
    let current = source
    const read = vi.fn(async () => current)
    const first = await readVueLikeCompilerInput(ctx.configService, filename, read)
    expect(first.source).toMatch(/from\s+['"]wevu['"]/)
    expect(transform(source, filename).code).toBe(first.source)
    current = source.replace('original', 'modified')
    const modified = await readVueLikeCompilerInput(ctx.configService, filename, read)
    expect(modified.source).toContain('modified')
    current = source
    expect(await readVueLikeCompilerInput(ctx.configService, filename, read)).toEqual(first)
    expect(read).toHaveBeenCalledTimes(3)
    expect(transformUniAppSource).toHaveBeenCalledTimes(2)
    await expect(withCompilerSourceSnapshot(
      ctx.configService,
      new Map([[compilerSourceId(filename), null]]),
      () => readVueLikeCompilerInput(ctx.configService, filename, read),
    )).rejects.toThrow('Source removed')
    expect(transformUniAppSource).toHaveBeenCalledTimes(2)
    expect(await readVueLikeCompilerInput(ctx.configService, filename, read)).toEqual(first)
    expect(read).toHaveBeenCalledTimes(4)
  })

  it('keeps external blocks, complete query ids and declared block types independent', () => {
    const config = createContext().configService
    const id = path.join(config.absoluteSrcRoot, 'external.html')
    const input = 'import { ref } from "vue"'
    expect(transformUniAppCompatibilitySource(config, input, id, 'template')).toBe(input)
    expect(transformUniAppCompatibilitySource(config, input, id, 'script')).toMatch(/from\s+['"]wevu['"]/)
    expect(transformUniAppCompatibilitySource(config, input, `${id}?one`, 'script')).toMatch(/from\s+['"]wevu['"]/)
    expect(transformUniAppCompatibilitySource(config, input, `${id}?two`, 'script')).toMatch(/from\s+['"]wevu['"]/)
    expect(transformUniAppCompatibilitySource(config, input, id, 'script')).toMatch(/from\s+['"]wevu['"]/)
    expect(transformUniAppSource).toHaveBeenCalledTimes(4)
    const changed = input.replace('ref', 'computed')
    expect(transformUniAppCompatibilitySource(config, changed, id, 'script')).toContain('computed')
    expect(transformUniAppCompatibilitySource(config, input, id, 'template')).toBe(input)
    expect(transformUniAppSource).toHaveBeenCalledTimes(5)
  })

  it('shares snapshot facts while isolating source configs, sessions, platforms and options', () => {
    const config = {}
    const owner = createContext(config)
    const snapshot = createContext(config)
    const reconfigured = createContext({})
    const anotherPlatform = createContext(config, { platform: 'alipay' })
    for (const child of [snapshot, reconfigured, anotherPlatform]) {
      attachHmrRuntimeSession(child, getHmrRuntimeSession(owner))
    }
    for (const child of [owner, snapshot, reconfigured]) {
      uniAppCompatibility(child)
    }
    const id = path.join(owner.configService.absoluteSrcRoot, 'Page.vue')
    const prepare = (ctx: CompilerContext) => transformUniAppCompatibilitySource(ctx.configService, source, id)
    const result = prepare(owner)
    expect(prepare(snapshot)).toBe(result)
    expect(transformUniAppSource).toHaveBeenCalledTimes(1)
    expect(prepare(reconfigured)).toBe(result)
    expect(prepare(createContext(config))).toBe(result)
    expect(prepare(anotherPlatform)).toBe(source)
    expect(transformUniAppSource).toHaveBeenCalledTimes(3)
    Object.assign(owner.configService.weappViteConfig, { uniApp: { include: ['fixture-ui', 'another-ui'] } })
    expect(prepare(owner)).toBe(result)
    expect(transformUniAppSource).toHaveBeenCalledTimes(4)
    Object.assign(owner.configService, { absoluteSrcRoot: path.join(path.dirname(id), 'another-root') })
    expect(prepare(owner)).toBe(source)
    Object.assign(owner.configService, { absoluteSrcRoot: path.dirname(id) })
    Object.assign(owner.configService.weappViteConfig, { uniApp: false })
    expect(prepare(owner)).toBe(source)
    expect(transformUniAppSource).toHaveBeenCalledTimes(4)
  })

  it('rechecks package ownership before consulting existing results', () => {
    const config = createContext().configService
    const id = path.resolve('fixture-project/node_modules/fixture-ui/Table.vue')
    const prepared = transformUniAppCompatibilitySource(config, source, id)
    Object.assign(config.weappViteConfig, { uniApp: { include: [] } })
    expect(transformUniAppCompatibilitySource(config, source, id)).toBe(source)
    Object.assign(config.weappViteConfig, { uniApp: { include: ['fixture-ui'] } })
    expect(transformUniAppCompatibilitySource(config, source, id)).toBe(prepared)
    expect(transformUniAppSource).toHaveBeenCalledOnce()
  })

  it('never caches errors or replaces their contextual cause', () => {
    const config = createContext().configService
    const filename = path.join(config.absoluteSrcRoot, 'Invalid.vue')
    for (let index = 0; index < 2; index += 1) {
      expect(() => transformUniAppCompatibilitySource(config, '<script>const = 1</script>', filename))
        .toThrow(UniAppCompatibilityTransformError)
    }
    expect(transformUniAppSource).toHaveBeenCalledTimes(2)
    expect(transformUniAppCompatibilitySource(config, source, filename)).toContain('original')
  })

  it('keeps watch generations and snapshot closure from clearing shared results', () => {
    const config = {}
    const ctx = createContext(config)
    const session = getHmrRuntimeSession(ctx)
    const plugin = uniAppCompatibility(ctx)[0]
    const id = path.join(ctx.configService.absoluteSrcRoot, 'Page.vue')
    const prepared = transformUniAppCompatibilitySource(ctx.configService, source, id)
    const closeBundle = plugin.closeBundle as (this: { meta: { watchMode: boolean } }) => void
    closeBundle.call({ meta: { watchMode: true } })
    expect(transformUniAppCompatibilitySource(ctx.configService, source, id)).toBe(prepared)
    const child = createContext(config)
    attachHmrRuntimeSession(child, session)
    const snapshot = uniAppCompatibility(child)[0]
    expect(transformUniAppCompatibilitySource(child.configService, source, id)).toBe(prepared)
    ;(snapshot.closeBundle as typeof closeBundle).call({ meta: { watchMode: false } })
    expect(getUniAppCompatibilitySessionStats(session)).toMatchObject({ entries: 1, hits: 2 })
    uniAppCompatibility(ctx)
    ;(plugin.closeWatcher as () => void)()
    expect(transformUniAppCompatibilitySource(ctx.configService, source, id)).toBe(prepared)
    expect(getUniAppCompatibilitySessionStats(session).hits).toBe(3)
    clearUniAppCompatibilitySession(session)
    expect(getUniAppCompatibilitySessionStats(session)).toEqual({ entries: 0, bytes: 0, hits: 0, misses: 0 })
    expect(transformUniAppCompatibilitySource(ctx.configService, source, id)).toBe(prepared)
    expect(transformUniAppSource).toHaveBeenCalledTimes(2)
  })
})

describe('uni-app result cache bounds', () => {
  it('retains complete repeated batches of 292 components and their external blocks', () => {
    const cache = new UniAppCompatibilityCache()
    const transform = vi.fn((input: string) => input.toUpperCase())
    const inputs = Array.from({ length: 292 }, (_, index) => ['sfc', 'script', 'style'].map(block => ({
      key: JSON.stringify([index, block]),
      input: `<view>component-${index}-${block}</view>`,
    }))).flat()
    for (let generation = 0; generation < 2; generation += 1) {
      for (const { key, input } of inputs) {
        expect(cache.transform(key, input, () => transform(input))).toBe(input.toUpperCase())
      }
    }
    expect(transform).toHaveBeenCalledTimes(inputs.length)
    expect(cache.stats.hits).toBe(inputs.length)
  })

  it('bounds count and retained bytes across scopes and clears all strings on teardown', () => {
    const cache = new UniAppCompatibilityCache(2, 128)
    const transform = vi.fn(() => 'result')
    cache.transform('first', 'source', transform)
    cache.transform('second', 'source', transform)
    cache.transform('first', 'source', transform)
    cache.transform('third', 'source', transform)
    expect(cache.stats).toMatchObject({ entries: 2, hits: 1, misses: 3 })
    cache.transform('second', 'source', transform)
    expect(transform).toHaveBeenCalledTimes(4)
    const entries = cache.stats.entries
    cache.transform('large', 'x'.repeat(128), transform)
    expect(cache.stats.entries).toBe(entries)
    expect(cache.stats.bytes).toBeLessThanOrEqual(128)
    cache.clear()
    expect(cache.stats).toEqual({ hits: 0, misses: 0, entries: 0, bytes: 0 })
  })
})
