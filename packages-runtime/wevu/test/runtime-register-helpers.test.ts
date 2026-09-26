import { WEVU_SLOT_OWNER_ID_KEY } from '@weapp-core/constants'
import { describe, expect, it, vi } from 'vitest'
import { runtimeCapabilityRegistry } from '@/runtime/capabilities'
import { installScopedSlots } from '@/runtime/features/scopedSlots'
import { runInlineExpression } from '@/runtime/register/inline'
import { runSetupFunction } from '@/runtime/register/setup'
import { refreshOwnerSnapshotFromInstance } from '@/runtime/register/snapshot'

import { createPathGetter, normalizeWatchDescriptor, registerWatches } from '@/runtime/register/watch'
import { updateOwnerSnapshot } from '@/runtime/scopedSlots'

vi.mock('@/runtime/scopedSlots', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/runtime/scopedSlots')>()
  return {
    ...actual,
    updateOwnerSnapshot: vi.fn(),
  }
})

describe('runtime: register helpers', () => {
  it('runs inline expression with parsed args', () => {
    const handler = vi.fn((msg: string, evt: any) => `${msg}-${evt.marker}`)
    const ctx = { onTap: handler }
    const event = {
      marker: 7,
      currentTarget: { dataset: { wvArgs: '["ok","$event"]' } },
    }

    const result = runInlineExpression(ctx, 'onTap', event)
    expect(handler).toHaveBeenCalledWith('ok', event)
    expect(result).toBe('ok-7')
  })

  it('decodes WXML-escaped args for inline expressions', () => {
    const handler = vi.fn(() => 'done')
    const ctx = { onTap: handler }
    const event = {
      currentTarget: { dataset: { wvArgs: '[&quot;ok&quot;]' } },
    }

    const result = runInlineExpression(ctx, 'onTap', event)
    expect(handler).toHaveBeenCalledWith('ok')
    expect(result).toBe('done')
  })

  it('returns undefined for non-string inline handlers', () => {
    const ctx = { onTap: vi.fn() }
    const event = { currentTarget: { dataset: { wvArgs: '[]' } } }
    expect(runInlineExpression(ctx, undefined, event)).toBeUndefined()
  })

  it.each(['wiTap', 'wi-tap', 'witap'])('resolves platform dataset key %s', (datasetKey) => {
    const handler = vi.fn()
    runInlineExpression(
      { handler },
      undefined,
      {
        type: 'tap',
        currentTarget: { dataset: { [datasetKey]: 'i0' } },
      },
      {
        i0: {
          keys: [],
          fn: ctx => ctx.handler(),
        },
      },
    )
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('injects runtime into setup context', () => {
    const setup = vi.fn((props: any, ctx: any) => ({ props, runtime: ctx.runtime }))
    const context: any = {}
    const result = runSetupFunction(setup, { foo: 1 }, context)

    expect((result as any)?.props).toEqual({ foo: 1 })
    expect((result as any)?.runtime).toBe(context.runtime)
    expect(context.runtime).toBeTruthy()
  })

  it('normalizes watch descriptors for functions and strings', () => {
    const runtime: any = {
      proxy: { marker: 'ok' },
      methods: {
        onChange(this: any): any {
          return this.marker
        },
      },
    }
    const instance: any = {}
    const fn = function (this: any) {
      return this.marker
    }
    const normalizedFn = normalizeWatchDescriptor(fn, runtime, instance)
    const normalizedStr = normalizeWatchDescriptor('onChange', runtime, instance)

    expect((normalizedFn as any)?.handler()).toBe('ok')
    expect((normalizedStr as any)?.handler()).toBe('ok')
  })

  it('creates path getters and registers watches', () => {
    const runtime: any = {
      proxy: { nested: { value: 5 } },
      watch: vi.fn(() => () => 'stop'),
    }
    const instance: any = {}
    const handler = vi.fn()

    const getter = createPathGetter(runtime.proxy, 'nested.value')
    expect(getter()).toBe(5)

    const stops = registerWatches(runtime, { 'nested.value': handler }, instance)
    expect(runtime.watch).toHaveBeenCalledTimes(1)
    expect(stops).toHaveLength(1)
  })

  it('defers a missing non-immediate setup source baseline', () => {
    const pause = vi.fn()
    const resume = vi.fn()
    const runtime: any = {
      proxy: {},
      watch: vi.fn(() => ({ pause, resume })),
    }

    const stops = registerWatches(runtime, {
      'injected.value': vi.fn((_value: any, _oldValue: any) => {}),
      'visible': { handler: vi.fn((_value: any, _oldValue: any) => {}), immediate: true },
    }, {} as any, { deferMissingSourceBaseline: true })

    expect(stops).toHaveLength(2)
    expect(pause).toHaveBeenCalledTimes(1)
    expect(resume).not.toHaveBeenCalled()
  })

  it('refreshes owner snapshot from instance props', () => {
    const runtime: any = {
      snapshot: () => ({ base: true }),
      proxy: { marker: 'proxy' },
    }
    const instance: any = {
      __wevu: runtime,
      __wvOwnerId: 'owner-1',
      data: { [WEVU_SLOT_OWNER_ID_KEY]: 'owner-1' },
      properties: { foo: 'bar' },
    }

    installScopedSlots()
    runtimeCapabilityRegistry.scopedSlots?.prepareMount(instance)

    refreshOwnerSnapshotFromInstance(instance)

    const updateOwnerSnapshotMock = vi.mocked(updateOwnerSnapshot)
    expect(updateOwnerSnapshotMock).toHaveBeenCalledWith(
      'owner-1',
      expect.objectContaining({ base: true, foo: 'bar' }),
      runtime.proxy,
      instance,
    )
  })
})
