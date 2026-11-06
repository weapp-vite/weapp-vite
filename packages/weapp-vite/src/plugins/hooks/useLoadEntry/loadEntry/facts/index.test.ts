import type { CompilerContext } from '../../../../../context'
import { describe, expect, it } from 'vitest'
import { attachHmrRuntimeSession, getHmrRuntimeSession } from '../../../../../runtime/hmrRuntimeSession'
import { getEntryAnalysisFacts } from './index'

function context(sourceConfig?: object, overrides: Record<string, unknown> = {}) {
  return {
    configService: {
      options: { sourceConfig },
      cwd: 'project',
      absoluteSrcRoot: 'src',
      platform: 'weapp',
      isDev: true,
      ...overrides,
    },
  } as unknown as CompilerContext
}

describe('entry content facts ownership', () => {
  it('shares facts across independent snapshots while isolating sessions, configs and targets', () => {
    const sourceConfig = {}
    const owner = context(sourceConfig)
    const snapshot = context(sourceConfig)
    const reconfigured = context({})
    const otherPlatform = context(sourceConfig, { platform: 'alipay' })
    const otherRoot = context(sourceConfig, { absoluteSrcRoot: 'plugin' })
    for (const child of [snapshot, reconfigured, otherPlatform, otherRoot]) {
      attachHmrRuntimeSession(child, getHmrRuntimeSession(owner))
    }
    const facts = getEntryAnalysisFacts(owner)
    expect(getEntryAnalysisFacts(snapshot)).toBe(facts)
    expect(getEntryAnalysisFacts(context(sourceConfig))).not.toBe(facts)
    expect(getEntryAnalysisFacts(reconfigured)).not.toBe(facts)
    expect(getEntryAnalysisFacts(otherPlatform)).not.toBe(facts)
    expect(getEntryAnalysisFacts(otherRoot)).not.toBe(facts)
  })

  it('keeps contexts without a source config independent', () => {
    const owner = context()
    const snapshot = context()
    attachHmrRuntimeSession(snapshot, getHmrRuntimeSession(owner))
    expect(getEntryAnalysisFacts(snapshot)).not.toBe(getEntryAnalysisFacts(owner))
  })

  it('rebuilds evicted root scopes without retaining every dynamic root', () => {
    const sourceConfig = {}
    const owner = context(sourceConfig)
    const contexts = Array.from({ length: 9 }, (_, index) => {
      const child = context(sourceConfig, { absoluteSrcRoot: `root-${index}` })
      attachHmrRuntimeSession(child, getHmrRuntimeSession(owner))
      return child
    })
    const first = getEntryAnalysisFacts(contexts[0])
    for (const child of contexts.slice(1, -1)) {
      getEntryAnalysisFacts(child)
    }
    const latest = getEntryAnalysisFacts(contexts[8])
    expect(getEntryAnalysisFacts(contexts[8])).toBe(latest)
    expect(getEntryAnalysisFacts(contexts[0])).not.toBe(first)
  })

  it('evicts old and oversized static config facts', () => {
    const { staticVueConfigCache } = getEntryAnalysisFacts(context({}))
    for (let index = 0; index < 513; index += 1) {
      staticVueConfigCache.set(`component-${index}.vue`, { source: '<template><view /></template>' })
    }
    expect(staticVueConfigCache.has('component-0.vue')).toBe(false)
    expect(staticVueConfigCache.has('component-512.vue')).toBe(true)
    staticVueConfigCache.set('oversized.vue', { source: 'x'.repeat(9 * 1024 * 1024) })
    expect(staticVueConfigCache.has('oversized.vue')).toBe(false)
    expect(staticVueConfigCache.size).toBeLessThanOrEqual(512)
  })
})
