import type { WevuRuntimeBindingManifestV1 } from '@weapp-core/constants'
import type { LayoutHostBinding, TemplateRefBinding } from '../capabilities'
import type { InlineExpressionMap } from '../register/inline'
import type { ComputedDefinitions } from '../types'
import {
  WEVU_BINDING_MANIFEST_KEY,
  WEVU_INLINE_HANDLER,
  WEVU_INLINE_MAP_KEY,
  WEVU_LAYOUT_HOSTS_KEY,
  WEVU_OWNER_HANDLER,
  WEVU_PROPS_DERIVED_KEYS_KEY,
  WEVU_PUBLIC_RUNTIME_KEY,
  WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY,
  WEVU_SLOT_FUNCTION_TOKEN,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_OWNER_KEY,
  WEVU_SLOT_OWNER_PROXY_KEY,
  WEVU_SLOT_PROPS_DATA_KEY,
  WEVU_SLOT_PROPS_KEY,
  WEVU_SLOT_SCOPE_KEY,
  WEVU_TEMPLATE_REFS_KEY,
} from '@weapp-core/constants'
import { hasOwn } from '../../utils'
import { cloneSnapshotValue, isDeepEqualValue } from '../app/setData/snapshot'
import { requireRuntimeCapability, runtimeCapabilityRegistry } from '../capabilities'
import { decodeWxmlEntities, resolveDatasetEventValue } from '../inlineDataset'
import { getOwnerProxy, getOwnerSnapshot, getOwnerTarget, subscribeOwner } from '../scopedSlots'

const SCOPED_SLOT_SNAPSHOT_OMIT_KEYS = [
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_OWNER_PROXY_KEY,
  WEVU_SLOT_OWNER_KEY,
  WEVU_SLOT_PROPS_DATA_KEY,
  WEVU_SLOT_PROPS_KEY,
  WEVU_SLOT_SCOPE_KEY,
]

function parseInlineArgs(event: any) {
  const dataset = event?.currentTarget?.dataset ?? event?.target?.dataset ?? {}
  const argsRaw = resolveDatasetEventValue(dataset, 'wvArgs', event)
  let args: any[] = []
  if (Array.isArray(argsRaw)) {
    args = argsRaw
  }
  else if (typeof argsRaw === 'string') {
    try {
      args = JSON.parse(argsRaw)
    }
    catch {
      try {
        args = JSON.parse(decodeWxmlEntities(argsRaw))
      }
      catch {
        args = []
      }
    }
  }
  if (!Array.isArray(args)) {
    args = []
  }
  return args.map((item: any) => item === '$event' ? event : item)
}

function normalizeSlotBindings(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object') {
    return {}
  }
  if (Array.isArray(value)) {
    const result: Record<string, any> = {}
    for (let i = 0; i < value.length; i += 2) {
      const key = value[i]
      if (typeof key === 'string' && key) {
        result[key] = value[i + 1]
      }
    }
    return result
  }
  return value as Record<string, any>
}

function isSlotFunctionDescriptor(value: unknown): value is [string, string, unknown[], unknown[]] {
  return Array.isArray(value)
    && value[0] === WEVU_SLOT_FUNCTION_TOKEN
    && typeof value[1] === 'string'
}

function createSlotFunctionProxy(instance: any, descriptor: [string, string, unknown[], unknown[]]) {
  return (...args: unknown[]) => {
    const owner = instance?.selectOwnerComponent?.()
    const handler = owner?.[WEVU_INLINE_HANDLER]
    if (typeof handler !== 'function') {
      return undefined
    }
    const dataset: Record<string, unknown> = {
      wd: 1,
      wi: descriptor[1],
    }
    const scopeBindings = Array.isArray(descriptor[2]) ? descriptor[2] : []
    const indexBindings = Array.isArray(descriptor[3]) ? descriptor[3] : []
    scopeBindings.forEach((value, index) => dataset[`wvS${index}`] = value)
    indexBindings.forEach((value, index) => dataset[`wvI${index}`] = value)
    const event = {
      type: 'wv-slot-function',
      detail: args,
      currentTarget: { dataset },
      target: { dataset },
    }
    return handler.call(owner, event)
  }
}

function resolveRuntimeSlotBindings(instance: any, bindings: Record<string, any>) {
  const resolved: Record<string, any> = {}
  for (const [key, value] of Object.entries(bindings)) {
    resolved[key] = isSlotFunctionDescriptor(value) ? createSlotFunctionProxy(instance, value) : value
  }
  return resolved
}

function resolveComputedContext(instance: any) {
  return instance?.__wevu?.proxy
    ?? instance?.[WEVU_PUBLIC_RUNTIME_KEY]?.proxy
    ?? instance
}

function collectComputedPayload(instance: any, computed?: ComputedDefinitions) {
  if (!computed || Object.keys(computed).length === 0) {
    return undefined
  }

  const context = resolveComputedContext(instance)
  const payload: Record<string, any> = {}
  for (const [key, definition] of Object.entries(computed)) {
    try {
      let value: any
      if (typeof definition === 'function') {
        value = definition.call(context)
      }
      else if (typeof (definition as any)?.get === 'function') {
        value = (definition as any).get.call(context)
      }
      if (value !== undefined) {
        payload[key] = value
      }
    }
    catch {
    }
  }
  return payload
}

function flushOwnerProxyBindings(instance: any) {
  instance?.__wevu?.__wevu_flushSetupSnapshotSync?.()
}

function flushScopedSlotComputedBindings(
  instance: any,
  computed?: ComputedDefinitions,
  options?: { force?: boolean },
) {
  flushOwnerProxyBindings(instance)
  const payload = collectComputedPayload(instance, computed)
  if (!payload || typeof instance?.setData !== 'function') {
    return
  }
  const hasPrevious = hasOwn(instance, '__wvScopedSlotComputedSnapshot')
  const previous = instance.__wvScopedSlotComputedSnapshot ?? {}
  const next: Record<string, any> = {}
  const changed: Record<string, any> = {}
  for (const [key, value] of Object.entries(payload)) {
    next[key] = cloneSnapshotValue(value)
    if (options?.force || !hasPrevious || !hasOwn(previous, key) || !isDeepEqualValue(previous[key], value, 20, { keys: 10_000 })) {
      changed[key] = value
    }
  }
  for (const key of Object.keys(previous)) {
    if (!hasOwn(payload, key)) {
      changed[key] = null
    }
  }
  instance.__wvScopedSlotComputedSnapshot = next
  if (Object.keys(changed).length > 0) {
    instance.setData(changed)
  }
}

function syncSlotPropsData(
  instance: any,
  override?: { [WEVU_SLOT_SCOPE_KEY]?: unknown, [WEVU_SLOT_PROPS_KEY]?: unknown },
) {
  const scopeSource = hasOwn(override ?? {}, WEVU_SLOT_SCOPE_KEY)
    ? (override as any)[WEVU_SLOT_SCOPE_KEY]
    : instance?.properties?.[WEVU_SLOT_SCOPE_KEY]
  const propsSource = hasOwn(override ?? {}, WEVU_SLOT_PROPS_KEY)
    ? (override as any)[WEVU_SLOT_PROPS_KEY]
    : instance?.properties?.[WEVU_SLOT_PROPS_KEY]
  const scope = normalizeSlotBindings(scopeSource)
  const slotProps = normalizeSlotBindings(propsSource)
  const snapshot = { ...scope, ...slotProps }
  const snapshotChanged = !hasOwn(instance, '__wvSlotPropsSnapshot')
    || !isDeepEqualValue(
      instance.__wvSlotPropsSnapshot ?? {},
      snapshot,
      20,
      { keys: 10_000 },
    )
  const merged = snapshotChanged || !instance[WEVU_SLOT_PROPS_DATA_KEY]
    ? resolveRuntimeSlotBindings(instance, snapshot)
    : instance[WEVU_SLOT_PROPS_DATA_KEY]
  if (snapshotChanged) {
    instance.__wvSlotPropsSnapshot = cloneSnapshotValue(snapshot)
  }
  instance[WEVU_SLOT_PROPS_DATA_KEY] = merged
  const runtimeState = instance?.__wevu?.state
  const runtimeSnapshotChanged = Boolean(
    runtimeState
    && typeof runtimeState === 'object'
    && (
      !hasOwn(runtimeState, WEVU_SLOT_PROPS_DATA_KEY)
      || !isDeepEqualValue(
        runtimeState[WEVU_SLOT_PROPS_DATA_KEY] ?? {},
        snapshot,
        20,
        { keys: 10_000 },
      )
    ),
  )
  if (runtimeState && typeof runtimeState === 'object') {
    runtimeState[WEVU_SLOT_PROPS_DATA_KEY] = merged
  }
  return { merged, runtimeSnapshotChanged, snapshot, snapshotChanged }
}

function mergeSlotProps(
  instance: any,
  computed?: ComputedDefinitions,
  override?: { [WEVU_SLOT_SCOPE_KEY]?: unknown, [WEVU_SLOT_PROPS_KEY]?: unknown },
) {
  const { runtimeSnapshotChanged, snapshot, snapshotChanged } = syncSlotPropsData(instance, override)
  if ((snapshotChanged || runtimeSnapshotChanged) && typeof instance?.setData === 'function') {
    instance.setData({ [WEVU_SLOT_PROPS_DATA_KEY]: snapshot })
  }
  if (snapshotChanged) {
    flushScopedSlotComputedBindings(instance, computed)
  }
}

function setOwnerProxy(instance: any, proxy: any) {
  let changed = false
  if (instance[WEVU_SLOT_OWNER_PROXY_KEY] !== proxy) {
    instance[WEVU_SLOT_OWNER_PROXY_KEY] = proxy
    changed = true
  }
  const data = instance?.data
  if (data && typeof data === 'object' && data[WEVU_SLOT_OWNER_PROXY_KEY] !== proxy) {
    try {
      Object.defineProperty(data, WEVU_SLOT_OWNER_PROXY_KEY, {
        value: proxy,
        configurable: true,
        enumerable: false,
        writable: true,
      })
    }
    catch {
      data[WEVU_SLOT_OWNER_PROXY_KEY] = proxy
    }
    changed = true
  }
  const runtimeState = instance?.__wevu?.state
  if (
    runtimeState
    && typeof runtimeState === 'object'
    && runtimeState[WEVU_SLOT_OWNER_PROXY_KEY] !== proxy
  ) {
    runtimeState[WEVU_SLOT_OWNER_PROXY_KEY] = proxy
    changed = true
  }
  return changed
}

function isSnapshotObject(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== 'object') {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function splitOwnerSnapshotFunctions(
  value: any,
  path: string,
  functionPayload: Record<string, any>,
  visiting: WeakSet<object>,
): any {
  if (typeof value === 'function') {
    functionPayload[path] = value
    return undefined
  }
  if (value == null || typeof value !== 'object') {
    return value
  }
  if (visiting.has(value)) {
    return undefined
  }
  if (Array.isArray(value)) {
    visiting.add(value)
    const output = value.map((item, index) => {
      const next = splitOwnerSnapshotFunctions(item, `${path}.${index}`, functionPayload, visiting)
      return next === undefined ? null : next
    })
    visiting.delete(value)
    return output
  }
  if (!isSnapshotObject(value)) {
    return cloneSnapshotValue(value)
  }
  visiting.add(value)
  const output: Record<string, any> = {}
  for (const [key, child] of Object.entries(value)) {
    const next = splitOwnerSnapshotFunctions(child, `${path}.${key}`, functionPayload, visiting)
    if (next !== undefined) {
      output[key] = next
    }
  }
  visiting.delete(value)
  return output
}

function createOwnerSetDataPayload(snapshot: Record<string, any>) {
  const functionPayload: Record<string, any> = {}
  const ownerSnapshot = splitOwnerSnapshotFunctions(
    snapshot,
    WEVU_SLOT_OWNER_KEY,
    functionPayload,
    new WeakSet(),
  )
  return {
    [WEVU_SLOT_OWNER_KEY]: ownerSnapshot,
    ...functionPayload,
  }
}

function updateOwnerBindings(instance: any, snapshot: Record<string, any>, proxy: any, computed?: ComputedDefinitions) {
  const proxyChanged = setOwnerProxy(instance, proxy)
  const { snapshotChanged: slotPropsChanged } = syncSlotPropsData(instance)
  const nextOwnerSnapshot = snapshot || {}
  const ownerChanged = !hasOwn(instance, '__wvOwnerSnapshot')
    || !isDeepEqualValue(
      instance.__wvOwnerSnapshot ?? {},
      nextOwnerSnapshot,
      20,
      { keys: 10_000 },
    )
  if (ownerChanged) {
    instance.__wvOwnerSnapshot = cloneSnapshotValue(nextOwnerSnapshot)
    instance[WEVU_SLOT_OWNER_KEY] = nextOwnerSnapshot
    const runtimeState = instance?.__wevu?.state
    if (runtimeState && typeof runtimeState === 'object') {
      runtimeState[WEVU_SLOT_OWNER_KEY] = nextOwnerSnapshot
    }
  }
  if (ownerChanged && typeof instance?.setData === 'function') {
    instance.setData(createOwnerSetDataPayload(nextOwnerSnapshot))
  }
  if (ownerChanged || proxyChanged || slotPropsChanged) {
    flushScopedSlotComputedBindings(instance, computed)
  }
}

function bindOwner(instance: any, ownerId: string, computed?: ComputedDefinitions) {
  if (!ownerId) {
    if (typeof instance?.__wvOwnerUnsub === 'function') {
      instance.__wvOwnerUnsub()
    }
    instance.__wvOwnerUnsub = undefined
    instance.__wvOwnerBoundId = ''
    setOwnerProxy(instance, undefined)
    return
  }

  const updateOwner = (snapshot: Record<string, any>, proxy: any) => {
    updateOwnerBindings(instance, snapshot, proxy, computed)
  }
  if (instance.__wvOwnerBoundId !== ownerId) {
    if (typeof instance.__wvOwnerUnsub === 'function') {
      instance.__wvOwnerUnsub()
    }
    instance.__wvOwnerBoundId = ownerId
    instance.__wvOwnerUnsub = subscribeOwner(ownerId, updateOwner)
  }
  const snapshot = getOwnerSnapshot(ownerId)
  if (snapshot) {
    updateOwner(snapshot, getOwnerProxy(ownerId))
  }
}

function resolveBoundOwnerId(instance: any) {
  return instance?.properties?.[WEVU_SLOT_OWNER_ID_PROP]
    ?? instance?.properties?.[WEVU_SLOT_OWNER_ID_KEY]
    ?? ''
}

function syncScopedSlotBindings(instance: any, computed?: ComputedDefinitions) {
  mergeSlotProps(instance, computed)
  const ownerId = resolveBoundOwnerId(instance)
  if (!ownerId) {
    return
  }
  bindOwner(instance, ownerId, computed)
}

function createScopedSlotData() {
  const data = {
    [WEVU_SLOT_OWNER_KEY]: {},
    [WEVU_SLOT_PROPS_DATA_KEY]: {},
  }
  Object.defineProperty(data, WEVU_SLOT_OWNER_PROXY_KEY, {
    value: undefined,
    configurable: true,
    enumerable: false,
    writable: true,
  })
  return data
}

export function createScopedSlotOptions(
  overrides?: {
    computed?: ComputedDefinitions
    inlineMap?: InlineExpressionMap
    layoutHosts?: LayoutHostBinding[]
    templateRefs?: TemplateRefBinding[]
    [WEVU_BINDING_MANIFEST_KEY]?: WevuRuntimeBindingManifestV1
  },
) {
  const scopedSlotComputed = overrides?.computed
  const layoutHosts = overrides?.layoutHosts
  const templateRefs = overrides?.templateRefs
  if (templateRefs?.length) {
    requireRuntimeCapability('templateRefs', 'createWevuScopedSlotComponent(templateRefs)')
  }
  const hasInlineMap = Boolean(overrides?.inlineMap && Object.keys(overrides.inlineMap).length)
  if (hasInlineMap) {
    requireRuntimeCapability('inlineEvents', 'createWevuScopedSlotComponent(inlineMap)')
  }
  if (layoutHosts?.length) {
    requireRuntimeCapability('layout', 'createWevuScopedSlotComponent(layoutHosts)')
  }
  const resolveTemplateRefOwner = (instance: any) => {
    const ownerId = resolveBoundOwnerId(instance)
    return ownerId ? getOwnerTarget(ownerId) : undefined
  }
  const baseOptions = {
    [WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY]: true,
    options: {
      virtualHost: true,
    },
    setData: {
      omit: SCOPED_SLOT_SNAPSHOT_OMIT_KEYS,
    },
    [WEVU_PROPS_DERIVED_KEYS_KEY]: SCOPED_SLOT_SNAPSHOT_OMIT_KEYS,
    properties: {
      [WEVU_SLOT_OWNER_ID_PROP]: {
        type: String,
        value: '',
        observer(this: any, next: string) {
          bindOwner(this, next || '', scopedSlotComputed)
        },
      },
      [WEVU_SLOT_OWNER_ID_KEY]: {
        type: String,
        value: '',
        observer(this: any, next: string) {
          bindOwner(this, next || '', scopedSlotComputed)
        },
      },
      [WEVU_SLOT_PROPS_KEY]: {
        type: null,
        value: null,
        observer(this: any, next: unknown) {
          mergeSlotProps(this, scopedSlotComputed, { [WEVU_SLOT_PROPS_KEY]: next })
        },
      },
      [WEVU_SLOT_SCOPE_KEY]: {
        type: null,
        value: null,
        observer(this: any, next: unknown) {
          mergeSlotProps(this, scopedSlotComputed, { [WEVU_SLOT_SCOPE_KEY]: next })
        },
      },
    },
    data: createScopedSlotData,
    lifetimes: {
      attached(this: any) {
        syncScopedSlotBindings(this, scopedSlotComputed)
      },
      ready(this: any) {
        syncScopedSlotBindings(this, scopedSlotComputed)
        flushScopedSlotComputedBindings(this, scopedSlotComputed, { force: true })
        const owner = resolveTemplateRefOwner(this)
        if (owner && templateRefs?.length) {
          runtimeCapabilityRegistry.templateRefs?.schedule(this, undefined, owner)
        }
      },
      detached(this: any) {
        const owner = resolveTemplateRefOwner(this)
        if (owner && templateRefs?.length) {
          runtimeCapabilityRegistry.templateRefs?.clear(this, owner)
        }
        if (typeof this.__wvOwnerUnsub === 'function') {
          this.__wvOwnerUnsub()
        }
        this.__wvOwnerUnsub = undefined
        this.__wvOwnerBoundId = ''
        setOwnerProxy(this, undefined)
      },
    },
    methods: {
      [WEVU_OWNER_HANDLER](this: any, event: any) {
        const owner = this[WEVU_SLOT_OWNER_PROXY_KEY]
        const inlineMap = (this as any).__wevu?.methods?.[WEVU_INLINE_MAP_KEY]
        if (hasInlineMap) {
          const result = runtimeCapabilityRegistry.inlineEvents?.run(owner, undefined, event, inlineMap)
          if (result !== undefined) {
            return result
          }
        }
        if (!owner) {
          return undefined
        }
        const dataset = event?.currentTarget?.dataset ?? event?.target?.dataset ?? {}
        const handlerName = resolveDatasetEventValue(dataset, 'wvHandler', event)
        if (typeof handlerName !== 'string' || !handlerName) {
          return undefined
        }
        const handler = owner?.[handlerName]
        if (typeof handler !== 'function') {
          return undefined
        }
        const args = parseInlineArgs(event)
        return handler.apply(owner, args)
      },
    },
  }

  if (overrides?.computed && Object.keys(overrides.computed).length > 0) {
    ;(baseOptions as any).computed = overrides.computed
  }
  if (overrides?.inlineMap && Object.keys(overrides.inlineMap).length > 0) {
    ;(baseOptions as any).methods = {
      ...(baseOptions as any).methods,
      [WEVU_INLINE_MAP_KEY]: overrides.inlineMap,
    }
  }
  if (templateRefs?.length) {
    ;(baseOptions as any)[WEVU_TEMPLATE_REFS_KEY] = templateRefs
  }
  if (layoutHosts?.length) {
    ;(baseOptions as Record<string, unknown>)[WEVU_LAYOUT_HOSTS_KEY] = layoutHosts
  }
  if (overrides?.[WEVU_BINDING_MANIFEST_KEY]) {
    ;(baseOptions as Record<string, unknown>)[WEVU_BINDING_MANIFEST_KEY] = overrides[WEVU_BINDING_MANIFEST_KEY]
  }

  return baseOptions
}
