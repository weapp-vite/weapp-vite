import type { MutableCompilerContext } from '../../context'
import { describe, expect, it, vi } from 'vitest'
import { ownsAutoRoutesTopologyChange, publishAutoRoutesTopology, registerAutoRoutesTopologySource, subscribeAutoRoutesTopology } from './topology'

function createContext(autoRoutes: unknown = true) {
  return {
    configService: { weappViteConfig: { autoRoutes } },
    autoRoutesService: {
      isRouteFile: (file: string) => file.startsWith('/project/src/pages/') || file === '/project/declarations/page.ts',
      isPageDeclarationSource: (file: string) => file === '/project/declarations/page.ts',
    },
  } as unknown as MutableCompilerContext
}

describe('auto routes topology ownership', () => {
  it('keeps other consumers and contexts alive across repeated or stale cleanup', () => {
    const ctx = createContext()
    const other = createContext()
    const first = vi.fn()
    const second = vi.fn()
    const unrelated = vi.fn()
    const releaseFirst = subscribeAutoRoutesTopology(ctx, first)
    const releaseSecond = subscribeAutoRoutesTopology(ctx, second)
    const releaseUnrelated = subscribeAutoRoutesTopology(other, unrelated)
    const event = { file: '/project/src/pages/new/index.vue', event: 'create' as const, topologyChanged: true }
    expect(publishAutoRoutesTopology(ctx, event)).toBe(true)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(unrelated).not.toHaveBeenCalled()

    releaseFirst()
    releaseFirst()
    publishAutoRoutesTopology(ctx, { ...event, event: 'delete' })
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(2)
    releaseSecond()
    expect(publishAutoRoutesTopology(ctx, event)).toBe(false)

    const next = vi.fn()
    const releaseNext = subscribeAutoRoutesTopology(ctx, next)
    releaseFirst()
    releaseSecond()
    expect(publishAutoRoutesTopology(ctx, event)).toBe(true)
    expect(next).toHaveBeenCalledTimes(1)
    expect(publishAutoRoutesTopology(other, event)).toBe(true)
    expect(unrelated).toHaveBeenCalledTimes(1)
    releaseNext()
    releaseUnrelated()
  })

  it.each([
    ['/project/src/pages/new/index.vue', 'create', true],
    ['/project/src/pages/old/index.js', 'delete', true],
    ['/project/declarations/page.ts', 'create', true],
    ['/project/src/pages/old/index.js', 'update', false],
    ['/project/src/pages/old/index.json', 'create', false],
    ['/project/src/pages/old/index.wxml', 'create', false],
    ['/project/src/helpers/new.ts', 'create', false],
  ] as const)('routes only owned %s %s events away from the module provider', (file, event, expected) => {
    const ctx = createContext()
    const release = subscribeAutoRoutesTopology(ctx, vi.fn())
    const releaseSource = registerAutoRoutesTopologySource(ctx, file => [
      '/project/src/pages/new/index.vue',
      '/project/src/pages/old/index.js',
      '/project/declarations/page.ts',
    ].includes(file))
    expect(ownsAutoRoutesTopologyChange(ctx, { file, event })).toBe(expected)
    release()
    expect(ownsAutoRoutesTopologyChange(ctx, { file, event })).toBe(false)
    releaseSource()
  })

  it('requires a real source owner and preserves the new owner after stale source cleanup', () => {
    const ctx = createContext()
    const change = { file: '/project/src/pages/new/index.vue', event: 'create' as const }
    const release = subscribeAutoRoutesTopology(ctx, vi.fn())
    expect(ownsAutoRoutesTopologyChange(ctx, change)).toBe(false)
    const oldSource = registerAutoRoutesTopologySource(ctx, () => true)
    const newSource = registerAutoRoutesTopologySource(ctx, () => true)
    oldSource()
    oldSource()
    expect(ownsAutoRoutesTopologyChange(ctx, change)).toBe(true)
    newSource()
    expect(ownsAutoRoutesTopologyChange(ctx, change)).toBe(false)
    release()
  })
})
