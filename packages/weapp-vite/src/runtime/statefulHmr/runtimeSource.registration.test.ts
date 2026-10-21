import { runInNewContext } from 'node:vm'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, WEAPP_VITE_STATEFUL_HMR_REGISTRATION_CONTRACT_VERSION, WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE } from '@weapp-core/constants'
import { describe, expect, it, vi } from 'vitest'
import { statefulHmrRolldownRuntimeSource } from './runtimeSource'

function runtime(definition: Record<string, unknown>) {
  const register = vi.fn()
  const globals = runInNewContext(`${statefulHmrRolldownRuntimeSource}\nglobalThis`, {
    DevRuntime: class {},
    setTimeout() {},
  })
  globals.__rolldown_runtime__.currentModuleId = 'pages/native/index'
  const bridge = globals[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY]
  bridge.installNative('Page', register)
  bridge.Page(definition)
  return {
    register,
    update(next: Record<string, unknown>) {
      bridge.beginUpdate()
      try {
        bridge.Page(next)
      }
      finally {
        bridge.endUpdate()
      }
    },
  }
}

describe('native registration capability boundary', () => {
  it.each([
    { data: { count: 0 }, increment() {}, nextStep() {} },
    { data: { count: 0 }, increment() {}, properties: { added: String } },
    { data: { count: 0 }, increment() {}, options: { virtualHost: true } },
    { data: { count: 0 }, increment() {}, lifetimes: { attached() {} } },
  ])('rejects a new host registration shape before replacing the working definition', (next) => {
    const initial = { data: { count: 0 }, increment() {} }
    const host = runtime(initial)
    expect(() => host.update(next)).toThrow(expect.objectContaining({ code: WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE }))
    expect(host.register).toHaveBeenCalledOnce()
    expect(host.register.mock.calls[0]![0].data).toEqual({ count: 0 })
  })

  it('keeps ordinary method edits and data defaults eligible without re-registering the page', () => {
    const host = runtime({ data: { count: 0 }, increment() {
      return 1
    } })
    expect(() => host.update({ data: { count: 7, added: 'new default' }, increment() {
      return 2
    } })).not.toThrow()
    expect(host.register).toHaveBeenCalledOnce()
  })

  it('compares property registration values rather than property enumeration order', () => {
    const host = runtime({ properties: { first: String, second: { type: Number, value: 0 } } })
    expect(() => host.update({ properties: { second: { value: 0, type: Number }, first: String } })).not.toThrow()
    expect(() => host.update({ properties: { first: Number, second: { type: Number, value: 0 } } }))
      .toThrow(expect.objectContaining({ code: WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE }))
  })

  it('rejects observer logic changes that cannot update the native registration', () => {
    const host = runtime({ observers: { count: function observed() {
      return 1
    } } })
    expect(() => host.update({ observers: { count: function observed() {
      return 2
    } } }))
      .toThrow(expect.objectContaining({ code: WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE }))
  })

  it.each(['observer', 'property observer', 'relation callback', 'definition filter', 'export'] as const)('rejects the same function body with a different captured value in a native %s', (field) => {
    const callback = (captured: number) => function callback() {
      return captured
    }
    const definition = (value: number) => {
      const fn = callback(value)
      if (field === 'observer') {
        return { observers: { count: fn } }
      }
      if (field === 'property observer') {
        return { properties: { count: { type: Number, observer: fn } } }
      }
      if (field === 'relation callback') {
        return { relations: { './child': { type: 'child', linked: fn } } }
      }
      if (field === 'definition filter') {
        return { definitionFilter: fn }
      }
      return { export: fn }
    }
    const initial = definition(1)
    const updated = definition(2)
    const host = runtime(initial)
    expect(() => host.update(updated)).toThrow(expect.objectContaining({ code: WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE }))
    expect(host.register).toHaveBeenCalledOnce()
  })

  it.each(['behavior', 'relation target'] as const)('keeps opaque %s identity without traversing its host-owned contents', (field) => {
    const opaque = { get unavailable() {
      throw new Error('host-owned object was traversed')
    } }
    const definition = (value: object) => field === 'behavior'
      ? { behaviors: [value] }
      : { relations: { './child': { type: 'child', target: value } } }
    const host = runtime(definition(opaque))
    expect(() => host.update(definition(opaque))).not.toThrow()
    expect(() => host.update(definition({}))).toThrow(expect.objectContaining({ code: WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE }))
  })

  it('handles cyclic registration objects without losing the cycle identity', () => {
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    const host = runtime({ options: { hostContract: cycle } })
    expect(() => host.update({ options: { hostContract: cycle } })).not.toThrow()
    const next: Record<string, unknown> = {}
    next.self = next
    expect(() => host.update({ options: { hostContract: next } })).toThrow(expect.objectContaining({ code: WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE }))
  })

  it('accepts an unchanged native callback reference without masking an ordinary getter failure', () => {
    const observer = vi.fn()
    const host = runtime({ observers: { count: observer } })
    expect(() => host.update({ observers: { count: observer } })).not.toThrow()
    const failure = new Error('user callback getter failed')
    expect(() => host.update({ observers: { get count() {
      throw failure
    } } })).toThrow(failure)
  })

  it.each([
    [{ options: { pureDataPattern: /^first/ } }, { options: { pureDataPattern: /^second/ } }],
    [{ behaviors: ['first-behavior'] }, { behaviors: ['second-behavior'] }],
    [{ methods: { increment() {} } }, { methods: { increment: undefined } }],
  ])('rejects changes to non-replaceable registration fields', (initial, updated) => {
    const host = runtime(initial)
    expect(() => host.update(updated)).toThrow(expect.objectContaining({ code: WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE }))
  })

  it('compares raw Wevu definitions across decorated native registration', () => {
    const globals = runInNewContext(`${statefulHmrRolldownRuntimeSource}\nglobalThis`, { DevRuntime: class {}, setTimeout() {} })
    globals.__rolldown_runtime__.currentModuleId = 'components/wevu-counter'
    const bridge = globals[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY]
    const refresh = vi.fn()
    const contract = { version: WEAPP_VITE_STATEFUL_HMR_REGISTRATION_CONTRACT_VERSION, nativeSlotContext: false }
    bridge.Component(bridge.trackWevuComponent({ methods: { increment() {
      return 1
    } } }, refresh, undefined, contract))
    bridge.beginUpdate()
    try {
      expect(() => bridge.trackWevuComponent({ methods: { increment() {
        return 2
      } } }, refresh, undefined, contract)).not.toThrow()
      expect(() => bridge.trackWevuComponent({ methods: { increment() {}, added() {} } }, refresh, undefined, contract))
        .toThrow(expect.objectContaining({ code: WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE }))
    }
    finally {
      bridge.endUpdate()
    }
  })

  it.each([undefined, { version: WEAPP_VITE_STATEFUL_HMR_REGISTRATION_CONTRACT_VERSION + 1 }])('detects a missing or incompatible raw Wevu contract: %s', (contract) => {
    const globals = runInNewContext(`${statefulHmrRolldownRuntimeSource}\nglobalThis`, { DevRuntime: class {}, setTimeout() {} })
    const bridge = globals[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY]
    expect(bridge.registrationContractVersion).toBe(WEAPP_VITE_STATEFUL_HMR_REGISTRATION_CONTRACT_VERSION)
    expect(() => bridge.trackWevuComponent({}, vi.fn(), undefined, contract)).toThrow(expect.objectContaining({
      code: WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE,
    }))
  })

  it('accepts regenerated Wevu wrappers while comparing their original user callbacks and captured inputs', () => {
    const globals = runInNewContext(`${statefulHmrRolldownRuntimeSource}\nglobalThis`, { DevRuntime: class {}, setTimeout() {} })
    globals.__rolldown_runtime__.currentModuleId = 'components/wevu-observers'
    const bridge = globals[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY]
    const definition = (captured: number) => ({
      observers: { '**': function generatedObserver(this: { properties?: { count?: number } }) { return this.properties?.count } },
      export: function generatedExport(this: { exposed?: object }) { return this.exposed ?? {} },
      methods: { increment() { return captured } },
    })
    const contract = {
      version: WEAPP_VITE_STATEFUL_HMR_REGISTRATION_CONTRACT_VERSION,
      nativeSlotContext: false,
      propsAliases: { localCount: 'count' },
      propsDerivedKeys: ['localCount'],
    }
    bridge.Component(bridge.trackWevuComponent(definition(1), vi.fn(), undefined, contract))
    bridge.beginUpdate()
    try {
      expect(() => bridge.trackWevuComponent(definition(2), vi.fn(), undefined, { ...contract })).not.toThrow()
      expect(() => bridge.trackWevuComponent(definition(3), vi.fn(), undefined, { ...contract, propsAliases: { changed: 'count' } }))
        .toThrow(expect.objectContaining({ code: WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE }))
    }
    finally {
      bridge.endUpdate()
    }
  })

  it.each([
    { field: 'templateRefs', before: [{ selector: '.before', inFor: false, name: 'counter' }], after: [{ selector: '.after', inFor: false, name: 'counter' }] },
    { field: 'layoutHosts', before: [{ key: 'counter', selector: '.before', refName: 'counter' }], after: [{ key: 'counter', selector: '.after', refName: 'counter' }] },
    { field: 'setupLifecycle', before: 'attached', after: 'created' },
  ])('rejects changes to Wevu initialization metadata: $field', ({ field, before, after }) => {
    const globals = runInNewContext(`${statefulHmrRolldownRuntimeSource}\nglobalThis`, { DevRuntime: class {}, setTimeout() {} })
    const bridge = globals[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY]
    const contract = {
      version: WEAPP_VITE_STATEFUL_HMR_REGISTRATION_CONTRACT_VERSION,
      nativeSlotContext: false,
      [field]: before,
    }
    const definition = { observers: { '**': function () {} }, export() {} }
    bridge.Component(bridge.trackWevuComponent(definition, vi.fn(), undefined, contract))
    bridge.beginUpdate()
    try {
      expect(() => bridge.trackWevuComponent(definition, vi.fn(), undefined, { ...contract, [field]: after })).toThrow(expect.objectContaining({
        code: WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE,
      }))
      expect(() => bridge.trackWevuComponent(definition, vi.fn(), undefined, { ...contract })).not.toThrow()
    }
    finally {
      bridge.endUpdate()
    }
  })

  it.each(['userObservers', 'userExport', 'templateRefs'] as const)('rejects a new Wevu %s closure even when its source text is unchanged', (field) => {
    const globals = runInNewContext(`${statefulHmrRolldownRuntimeSource}\nglobalThis`, { DevRuntime: class {}, setTimeout() {} })
    const bridge = globals[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY]
    const callback = (captured: number) => function originalCallback() {
      return captured
    }
    const contract = (value: number) => {
      let input: unknown = callback(value)
      if (field === 'userObservers') {
        input = { count: input }
      }
      if (field === 'templateRefs') {
        input = [{ selector: '.counter', inFor: false, get: input }]
      }
      return {
        version: WEAPP_VITE_STATEFUL_HMR_REGISTRATION_CONTRACT_VERSION,
        nativeSlotContext: false,
        [field]: input,
      }
    }
    const definition = { observers: { '**': function () {} }, export() {} }
    bridge.Component(bridge.trackWevuComponent(definition, vi.fn(), undefined, contract(1)))
    bridge.beginUpdate()
    try {
      expect(() => bridge.trackWevuComponent(definition, vi.fn(), undefined, contract(2))).toThrow(expect.objectContaining({
        code: WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE,
      }))
    }
    finally {
      bridge.endUpdate()
    }
  })
})
