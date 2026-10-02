import type { CompilerContext } from '../context'
import { describe, expect, it, vi } from 'vitest'
import { createLibDtsPlugin } from './libDts'

describe('library declaration watch inputs', () => {
  it.each([
    { config: undefined, watch: true, expected: [] },
    { config: { root: 'src/library', dts: { enabled: false } }, watch: true, expected: [] },
    { config: { root: 'src/library' }, watch: false, expected: [] },
    { config: { root: 'src/library' }, watch: true, expected: ['src/library'] },
  ])('registers only enabled library roots (%j)', async ({ config, watch, expected }) => {
    const ctx = { configService: { weappLibConfig: config } } as CompilerContext
    const hook = createLibDtsPlugin(ctx).buildStart
    const handler = typeof hook === 'function' ? hook : hook?.handler
    const addWatchFile = vi.fn()
    await handler?.call({ meta: { watchMode: watch }, addWatchFile } as any, {} as any)
    expect(addWatchFile.mock.calls.map(([file]) => file)).toEqual(expected)
  })
})
