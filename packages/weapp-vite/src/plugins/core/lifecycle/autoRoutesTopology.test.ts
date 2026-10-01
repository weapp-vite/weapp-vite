import type { MutableCompilerContext } from '../../../context'
import { expect, it, vi } from 'vitest'
import { markAppEntryForAutoRoutesTopology } from './autoRoutesTopology'

it.each([false, true])('invalidates callable loaders before notifying topology consumers (loaded=%s)', (loaded) => {
  const order: string[] = []
  const loadEntry = Object.assign(vi.fn(), {
    invalidateResolveCache: vi.fn(() => order.push('invalidate')),
  })
  const appEntryId = '/project/src/app.ts'
  const ctx = {
    scanService: { appEntry: { path: appEntryId } },
    configService: {},
    runtimeState: { build: { hmr: { appEntryAutoRoutesSignature: 'stale' } } },
    onStatefulHmrSourceChange: vi.fn(() => order.push('notify')),
  } as unknown as MutableCompilerContext
  const markEntryDirty = vi.fn(() => order.push('dirty'))

  const changed = markAppEntryForAutoRoutesTopology(ctx, {
    loadEntry,
    markEntryDirty,
    resolvedEntryMap: new Map(loaded ? [[appEntryId, {}]] : []),
  })

  expect(loadEntry.invalidateResolveCache).toHaveBeenCalledOnce()
  expect(ctx.runtimeState.build.hmr.appEntryAutoRoutesSignature).toBeUndefined()
  expect(changed).toBe(loaded)
  expect(order).toEqual(loaded ? ['invalidate', 'dirty', 'notify'] : ['invalidate'])
})
