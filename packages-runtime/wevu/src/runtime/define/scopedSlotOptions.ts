/* eslint-disable ts/no-use-before-define */
import type { InlineExpressionMap } from '../register/inline'
import type { ComputedDefinitions } from '../types'
import {
  WEVU_GENERIC_SLOT_OWNER_DATA_KEY,
  WEVU_GENERIC_SLOT_OWNER_ID_ATTR,
  WEVU_GENERIC_SLOT_OWNER_ID_PROP,
  WEVU_GENERIC_SLOT_OWNER_PROP_PREFIX,
  WEVU_GENERIC_SLOT_OWNER_PROPS_ATTR,
  WEVU_GENERIC_SLOT_PROPS_ATTR,
  WEVU_GENERIC_SLOT_PROPS_DATA_ATTR,
  WEVU_GENERIC_SLOT_PROPS_DATA_KEY,
  WEVU_GENERIC_SLOT_PROPS_PROP,
  WEVU_GENERIC_SLOT_SCOPE_ATTR,
  WEVU_GENERIC_SLOT_SCOPE_PROP,
  WEVU_INLINE_MAP_KEY,
  WEVU_OWNER_HANDLER,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_OWNER_KEY,
  WEVU_SLOT_PROPS_DATA_KEY,
  WEVU_SLOT_PROPS_KEY,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'
import { markRaw } from '../../reactivity'
import { hasOwn } from '../../utils'
import { cloneSnapshotValue } from '../app/setData/snapshot'
import { resolveDatasetEventValue, runInlineExpression } from '../register/inline'
import { getFallbackSlotOwnerId, getOwnerProxy, getOwnerSnapshot, rememberSlotOwnerId, subscribeOwner } from '../scopedSlots'

const AMP_RE = /&amp;/g
const QUOT_RE = /&quot;/g
const NUM_QUOT_RE = /&#34;/g
const APOS_RE = /&apos;/g
const NUM_APOS_RE = /&#39;/g
const LT_RE = /&lt;/g
const GT_RE = /&gt;/g
const OWNER_PROPS_OVERRIDE_KEY = '__wvOwnerPropsOverride'
const SLOT_OWNER_PROXY_KEY = '__wvOwnerProxy'
const SLOT_PROPS_OVERRIDE_KEY = '__wvSlotPropsOverride'
const SLOT_SCOPE_OVERRIDE_KEY = '__wvSlotScopeOverride'

function decodeWxmlEntities(value: string) {
  return value
    .replace(AMP_RE, '&')
    .replace(QUOT_RE, '"')
    .replace(NUM_QUOT_RE, '"')
    .replace(APOS_RE, '\'')
    .replace(NUM_APOS_RE, '\'')
    .replace(LT_RE, '<')
    .replace(GT_RE, '>')
}

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

function mergeSlotProps(
  instance: any,
  override?: Record<string, unknown>,
) {
  if (hasOwn(override ?? {}, WEVU_SLOT_SCOPE_KEY)) {
    instance[SLOT_SCOPE_OVERRIDE_KEY] = (override as any)[WEVU_SLOT_SCOPE_KEY]
  }
  else if (hasOwn(override ?? {}, WEVU_GENERIC_SLOT_SCOPE_PROP)) {
    instance[SLOT_SCOPE_OVERRIDE_KEY] = (override as any)[WEVU_GENERIC_SLOT_SCOPE_PROP]
  }
  else if (hasOwn(override ?? {}, WEVU_GENERIC_SLOT_SCOPE_ATTR)) {
    instance[SLOT_SCOPE_OVERRIDE_KEY] = (override as any)[WEVU_GENERIC_SLOT_SCOPE_ATTR]
  }
  if (hasOwn(override ?? {}, WEVU_SLOT_PROPS_KEY)) {
    instance[SLOT_PROPS_OVERRIDE_KEY] = (override as any)[WEVU_SLOT_PROPS_KEY]
  }
  else if (hasOwn(override ?? {}, WEVU_GENERIC_SLOT_PROPS_PROP)) {
    instance[SLOT_PROPS_OVERRIDE_KEY] = (override as any)[WEVU_GENERIC_SLOT_PROPS_PROP]
  }
  else if (hasOwn(override ?? {}, WEVU_GENERIC_SLOT_PROPS_ATTR)) {
    instance[SLOT_PROPS_OVERRIDE_KEY] = (override as any)[WEVU_GENERIC_SLOT_PROPS_ATTR]
  }
  const scopeSource = hasOwn(override ?? {}, WEVU_SLOT_SCOPE_KEY)
    ? (override as any)[WEVU_SLOT_SCOPE_KEY]
    : hasOwn(override ?? {}, WEVU_GENERIC_SLOT_SCOPE_PROP)
      ? (override as any)[WEVU_GENERIC_SLOT_SCOPE_PROP]
      : hasOwn(override ?? {}, WEVU_GENERIC_SLOT_SCOPE_ATTR)
        ? (override as any)[WEVU_GENERIC_SLOT_SCOPE_ATTR]
        : hasOwn(instance ?? {}, SLOT_SCOPE_OVERRIDE_KEY)
          ? instance[SLOT_SCOPE_OVERRIDE_KEY]
          : instance?.properties?.[WEVU_SLOT_SCOPE_KEY]
            ?? instance?.properties?.[WEVU_GENERIC_SLOT_SCOPE_PROP]
            ?? instance?.properties?.[WEVU_GENERIC_SLOT_SCOPE_ATTR]
  const propsSource = hasOwn(override ?? {}, WEVU_SLOT_PROPS_KEY)
    ? (override as any)[WEVU_SLOT_PROPS_KEY]
    : hasOwn(override ?? {}, WEVU_GENERIC_SLOT_PROPS_PROP)
      ? (override as any)[WEVU_GENERIC_SLOT_PROPS_PROP]
      : hasOwn(override ?? {}, WEVU_GENERIC_SLOT_PROPS_ATTR)
        ? (override as any)[WEVU_GENERIC_SLOT_PROPS_ATTR]
        : hasOwn(instance ?? {}, SLOT_PROPS_OVERRIDE_KEY)
          ? instance[SLOT_PROPS_OVERRIDE_KEY]
          : instance?.properties?.[WEVU_SLOT_PROPS_KEY]
            ?? instance?.properties?.[WEVU_GENERIC_SLOT_PROPS_PROP]
            ?? instance?.properties?.[WEVU_GENERIC_SLOT_PROPS_ATTR]
  const scope = normalizeSlotBindings(scopeSource)
  const slotProps = normalizeSlotBindings(propsSource)
  const merged = { ...scope, ...slotProps }
  syncScopedSlotData(instance, {
    [WEVU_SLOT_PROPS_DATA_KEY]: merged,
    [WEVU_GENERIC_SLOT_PROPS_DATA_KEY]: merged,
  })
}

function resolveOwnerPropsOverride(instance: any, override?: unknown) {
  if (override !== undefined) {
    const ownerProps = normalizeSlotBindings(override)
    instance[OWNER_PROPS_OVERRIDE_KEY] = ownerProps
    return ownerProps
  }
  if (hasOwn(instance ?? {}, OWNER_PROPS_OVERRIDE_KEY)) {
    return normalizeSlotBindings(instance[OWNER_PROPS_OVERRIDE_KEY])
  }
  const properties = instance?.properties
  if (!properties || typeof properties !== 'object') {
    return {}
  }
  return normalizeSlotBindings(properties[WEVU_GENERIC_SLOT_OWNER_PROPS_ATTR])
}

function syncOwnerPropsOverride(instance: any, override?: unknown) {
  const ownerProps = resolveOwnerPropsOverride(instance, override)
  if (!Object.keys(ownerProps).length) {
    return ownerProps
  }
  syncRuntimeState(instance, {
    [WEVU_SLOT_OWNER_KEY]: {
      ...(instance?.__wevu?.state?.[WEVU_SLOT_OWNER_KEY] ?? {}),
      ...ownerProps,
    },
    [WEVU_GENERIC_SLOT_OWNER_DATA_KEY]: {
      ...(instance?.__wevu?.state?.[WEVU_GENERIC_SLOT_OWNER_DATA_KEY] ?? {}),
      ...ownerProps,
    },
  })
  syncNativeData(instance, createScopedSlotOwnerSetDataPayload(ownerProps))
  return ownerProps
}

function syncRuntimeState(instance: any, payload: Record<string, any>) {
  const state = instance?.__wevu?.state
  if (!state || typeof state !== 'object') {
    return
  }
  for (const [key, value] of Object.entries(payload)) {
    try {
      state[key] = value
    }
    catch {
      // 忽略运行时状态同步异常
    }
  }
}

function syncScopedSlotData(instance: any, payload: Record<string, any>) {
  syncRuntimeState(instance, payload)
  if (typeof instance?.setData === 'function') {
    instance.setData(payload)
  }
}

function syncSlotPropsDataSource(instance: any, source: unknown) {
  const slotProps = normalizeSlotBindings(source)
  instance[SLOT_PROPS_OVERRIDE_KEY] = {
    ...normalizeSlotBindings(instance?.[SLOT_PROPS_OVERRIDE_KEY]),
    ...slotProps,
  }
  syncScopedSlotData(instance, {
    [WEVU_SLOT_PROPS_DATA_KEY]: slotProps,
    [WEVU_GENERIC_SLOT_PROPS_DATA_KEY]: slotProps,
  })
}

function syncNativeData(instance: any, payload: Record<string, any>) {
  if (typeof instance?.setData === 'function') {
    instance.setData(payload)
    return
  }
  const data = instance?.data
  if (!data || typeof data !== 'object') {
    return
  }
  Object.assign(data, payload)
}

function assignDefinedBinding(target: Record<string, any>, key: unknown, value: unknown) {
  if (typeof key === 'string' && key && value !== undefined) {
    target[key] = value
  }
}

function mergeDefinedBindings(target: Record<string, any>, value: unknown) {
  const bindings = normalizeSlotBindings(value)
  for (const [key, bindingValue] of Object.entries(bindings)) {
    assignDefinedBinding(target, key, bindingValue)
  }
}

function createScopedSlotOwnerSetDataPayload(ownerSnapshot: Record<string, any>) {
  const payload: Record<string, any> = {
    [WEVU_SLOT_OWNER_KEY]: ownerSnapshot,
    [WEVU_GENERIC_SLOT_OWNER_DATA_KEY]: ownerSnapshot,
    [WEVU_SLOT_PROPS_DATA_KEY]: ownerSnapshot,
    [WEVU_GENERIC_SLOT_PROPS_DATA_KEY]: ownerSnapshot,
  }
  for (const [key, value] of Object.entries(ownerSnapshot)) {
    if (value === undefined) {
      continue
    }
    payload[`${WEVU_SLOT_OWNER_KEY}.${key}`] = value
    payload[`${WEVU_GENERIC_SLOT_OWNER_DATA_KEY}.${key}`] = value
    payload[`${WEVU_GENERIC_SLOT_OWNER_PROP_PREFIX}${key}`] = value
  }
  return payload
}

function resolveMergedSlotPropsData(instance: any, ownerSnapshot: Record<string, any>) {
  const slotProps = {
    ...ownerSnapshot,
    ...normalizeSlotBindings(instance?.[SLOT_SCOPE_OVERRIDE_KEY]),
    ...normalizeSlotBindings(instance?.[SLOT_PROPS_OVERRIDE_KEY]),
  }
  return slotProps
}

function collectScopedSlotOwnerComponentState(instance: any) {
  const owner = typeof instance?.selectOwnerComponent === 'function'
    ? instance.selectOwnerComponent()
    : undefined
  const parent = typeof owner?.selectOwnerComponent === 'function'
    ? owner.selectOwnerComponent()
    : undefined
  const ownerProps: Record<string, any> = {}
  const slotProps: Record<string, any> = {}

  const collectSource = (source: any) => {
    if (!source || typeof source !== 'object') {
      return
    }
    mergeDefinedBindings(ownerProps, source[WEVU_SLOT_OWNER_KEY])
    mergeDefinedBindings(ownerProps, source[WEVU_GENERIC_SLOT_OWNER_DATA_KEY])
    mergeDefinedBindings(ownerProps, source[WEVU_GENERIC_SLOT_OWNER_PROPS_ATTR])
    mergeDefinedBindings(slotProps, source[WEVU_SLOT_PROPS_DATA_KEY])
    mergeDefinedBindings(slotProps, source[WEVU_GENERIC_SLOT_PROPS_DATA_KEY])
    mergeDefinedBindings(slotProps, source[WEVU_GENERIC_SLOT_PROPS_DATA_ATTR])
    for (const [key, value] of Object.entries(source)) {
      if (key.startsWith(WEVU_GENERIC_SLOT_OWNER_PROP_PREFIX)) {
        assignDefinedBinding(ownerProps, key.slice(WEVU_GENERIC_SLOT_OWNER_PROP_PREFIX.length), value)
      }
      else if (key.startsWith(`${WEVU_GENERIC_SLOT_PROPS_DATA_ATTR}_`)) {
        mergeDefinedBindings(slotProps, value)
      }
    }
  }

  for (const component of [parent, owner]) {
    collectSource(component?.properties)
    collectSource(component?.data)
    collectSource(component)
  }

  return {
    ownerProps,
    slotProps,
  }
}

function syncOwnerComponentScopedSlotState(instance: any) {
  const { ownerProps, slotProps } = collectScopedSlotOwnerComponentState(instance)
  const merged = {
    ...slotProps,
    ...ownerProps,
  }
  if (!Object.keys(merged).length) {
    return
  }
  instance[OWNER_PROPS_OVERRIDE_KEY] = {
    ...normalizeSlotBindings(instance[OWNER_PROPS_OVERRIDE_KEY]),
    ...merged,
  }
  syncRuntimeState(instance, {
    [WEVU_SLOT_OWNER_KEY]: {
      ...(instance?.__wevu?.state?.[WEVU_SLOT_OWNER_KEY] ?? {}),
      ...merged,
    },
    [WEVU_GENERIC_SLOT_OWNER_DATA_KEY]: {
      ...(instance?.__wevu?.state?.[WEVU_GENERIC_SLOT_OWNER_DATA_KEY] ?? {}),
      ...merged,
    },
    [WEVU_SLOT_PROPS_DATA_KEY]: merged,
    [WEVU_GENERIC_SLOT_PROPS_DATA_KEY]: merged,
  })
  syncNativeData(instance, createScopedSlotOwnerSetDataPayload(merged))
}

function createScopedSlotComputedContext(instance: any, ownerSnapshot: Record<string, any>, ownerProxy: any) {
  const state = instance?.__wevu?.state
  return new Proxy(Object.create(null), {
    get(_target, key) {
      if (key === SLOT_OWNER_PROXY_KEY) {
        return ownerProxy
      }
      if (key === WEVU_SLOT_OWNER_KEY || key === WEVU_GENERIC_SLOT_OWNER_DATA_KEY) {
        return ownerSnapshot
      }
      if (state && typeof state === 'object' && key in state) {
        return state[key as keyof typeof state]
      }
      return instance?.[key as keyof typeof instance]
    },
    has(_target, key) {
      return key === SLOT_OWNER_PROXY_KEY
        || key === WEVU_SLOT_OWNER_KEY
        || key === WEVU_GENERIC_SLOT_OWNER_DATA_KEY
        || Boolean(state && typeof state === 'object' && key in state)
        || Boolean(instance && key in instance)
    },
  })
}

function collectScopedSlotComputedDataFromDefs(
  instance: any,
  ownerSnapshot: Record<string, any>,
  ownerProxy: any,
  computedDefs: ComputedDefinitions,
) {
  const payload: Record<string, any> = {}
  const context = createScopedSlotComputedContext(instance, ownerSnapshot, ownerProxy)
  for (const [key, definition] of Object.entries(computedDefs)) {
    try {
      const getter = typeof definition === 'function' ? definition : definition?.get
      if (typeof getter !== 'function') {
        continue
      }
      const value = getter.call(context)
      if (value !== undefined) {
        payload[key] = cloneSnapshotValue(value)
      }
    }
    catch {
      // 忽略单个计算绑定失败，保持 scoped slot 其他绑定可继续同步。
    }
  }
  return payload
}

function collectScopedSlotComputedData(
  instance: any,
  ownerSnapshot: Record<string, any>,
  ownerProxy: any,
  computedDefs?: ComputedDefinitions,
) {
  if (computedDefs && typeof computedDefs === 'object') {
    return collectScopedSlotComputedDataFromDefs(instance, ownerSnapshot, ownerProxy, computedDefs)
  }
  const computed = instance?.__wevu?.computed
  if (!computed || typeof computed !== 'object') {
    return {}
  }
  const payload: Record<string, any> = {}
  for (const key of Object.keys(computed)) {
    try {
      const value = computed[key]
      if (value !== undefined) {
        payload[key] = cloneSnapshotValue(value)
      }
    }
    catch {
      // 忽略单个计算绑定失败，保持 scoped slot 其他绑定可继续同步。
    }
  }
  return payload
}

function syncScopedSlotOwnerSnapshot(
  instance: any,
  snapshot: Record<string, any>,
  proxy: any,
  computedDefs?: ComputedDefinitions,
) {
  const ownerSnapshot = {
    ...cloneSnapshotValue(snapshot || {}),
    ...resolveOwnerPropsOverride(instance),
  }
  const ownerProxy = proxy && typeof proxy === 'object' ? markRaw(proxy) : proxy
  instance[SLOT_OWNER_PROXY_KEY] = ownerProxy
  syncRuntimeState(instance, {
    [WEVU_SLOT_OWNER_KEY]: ownerSnapshot,
    [SLOT_OWNER_PROXY_KEY]: ownerProxy,
  })
  const flushSetupSnapshot = instance.__wevu?.__wevu_flushSetupSnapshotSync
  if (typeof flushSetupSnapshot === 'function') {
    flushSetupSnapshot()
  }
  const computedPayload = collectScopedSlotComputedData(instance, ownerSnapshot, ownerProxy, computedDefs)
  const mergedOwnerSnapshot = {
    ...ownerSnapshot,
    ...computedPayload,
  }
  for (const [key, value] of Object.entries(computedPayload)) {
    ownerSnapshot[key] = value
  }
  syncRuntimeState(instance, {
    [WEVU_SLOT_OWNER_KEY]: mergedOwnerSnapshot,
  })
  const payload = {
    ...computedPayload,
    ...createScopedSlotOwnerSetDataPayload(mergedOwnerSnapshot),
  }
  const slotPropsData = resolveMergedSlotPropsData(instance, mergedOwnerSnapshot)
  payload[WEVU_SLOT_PROPS_DATA_KEY] = slotPropsData
  payload[WEVU_GENERIC_SLOT_PROPS_DATA_KEY] = slotPropsData
  syncNativeData(instance, payload)
}

function enqueueScopedSlotOwnerSync(
  instance: any,
  snapshot: Record<string, any>,
  proxy: any,
  computedDefs?: ComputedDefinitions,
) {
  instance.__wvOwnerPendingSnapshot = snapshot
  instance.__wvOwnerPendingProxy = proxy
  if (instance.__wvOwnerSyncTimer) {
    return
  }
  const flush = () => {
    instance.__wvOwnerSyncTimer = undefined
    const pendingSnapshot = instance.__wvOwnerPendingSnapshot
    const pendingProxy = instance.__wvOwnerPendingProxy
    instance.__wvOwnerPendingSnapshot = undefined
    instance.__wvOwnerPendingProxy = undefined
    syncScopedSlotOwnerSnapshot(instance, pendingSnapshot || {}, pendingProxy, computedDefs)
  }
  if (typeof setTimeout === 'function') {
    instance.__wvOwnerSyncTimer = setTimeout(flush, 0)
  }
  else {
    flush()
  }
}

function subscribeScopedSlotOwner(instance: any, ownerId: string, computedDefs?: ComputedDefinitions) {
  if (instance.__wvOwnerIdCurrent === ownerId) {
    return
  }
  if (typeof instance.__wvOwnerUnsub === 'function') {
    instance.__wvOwnerUnsub()
  }
  instance.__wvOwnerUnsub = undefined
  instance.__wvOwnerIdCurrent = ownerId
  if (!ownerId) {
    return
  }
  const updateOwner = (snapshot: Record<string, any>, proxy: any) => {
    enqueueScopedSlotOwnerSync(instance, snapshot, proxy, computedDefs)
  }
  instance.__wvOwnerUnsub = subscribeOwner(ownerId, updateOwner)
  const snapshot = getOwnerSnapshot(ownerId)
  if (snapshot) {
    updateOwner(snapshot, getOwnerProxy(ownerId))
  }
}

function resolveScopedSlotOwnerId(instance: any) {
  const ownOwnerId = resolveScopedSlotOwnOwnerId(instance)
  const resolveCandidate = (...values: unknown[]) => {
    for (const value of values) {
      if (typeof value === 'string' && value && value !== ownOwnerId) {
        rememberSlotOwnerId(value)
        return value
      }
    }
    return ''
  }
  const selfCandidate = (
    instance?.properties?.[WEVU_SLOT_OWNER_ID_KEY]
    || instance?.[WEVU_SLOT_OWNER_ID_KEY]
  )
  const resolveComponentOwnerId = (component: any) => {
    const data = component?.data
    const properties = component?.properties
    return resolveCandidate(
      properties?.[WEVU_GENERIC_SLOT_OWNER_ID_ATTR],
      properties?.[WEVU_GENERIC_SLOT_OWNER_ID_PROP],
      properties?.[WEVU_SLOT_OWNER_ID_PROP],
      properties?.[WEVU_SLOT_OWNER_ID_KEY],
      data?.[WEVU_GENERIC_SLOT_OWNER_ID_ATTR],
      data?.[WEVU_GENERIC_SLOT_OWNER_ID_PROP],
      data?.[WEVU_SLOT_OWNER_ID_PROP],
      data?.[WEVU_SLOT_OWNER_KEY]?.[WEVU_GENERIC_SLOT_OWNER_ID_ATTR],
      data?.[WEVU_SLOT_OWNER_KEY]?.[WEVU_GENERIC_SLOT_OWNER_ID_PROP],
      data?.[WEVU_SLOT_OWNER_KEY]?.[WEVU_SLOT_OWNER_ID_PROP],
      data?.[WEVU_SLOT_OWNER_KEY]?.[WEVU_SLOT_OWNER_ID_KEY],
      data?.[WEVU_SLOT_OWNER_KEY]?.[WEVU_SLOT_OWNER_KEY]?.[WEVU_GENERIC_SLOT_OWNER_ID_ATTR],
      data?.[WEVU_SLOT_OWNER_KEY]?.[WEVU_SLOT_OWNER_KEY]?.[WEVU_GENERIC_SLOT_OWNER_ID_PROP],
      data?.[WEVU_SLOT_OWNER_KEY]?.[WEVU_SLOT_OWNER_KEY]?.[WEVU_SLOT_OWNER_ID_PROP],
      data?.[WEVU_SLOT_OWNER_KEY]?.[WEVU_SLOT_OWNER_KEY]?.[WEVU_SLOT_OWNER_ID_KEY],
      component?.[WEVU_GENERIC_SLOT_OWNER_ID_ATTR],
      component?.[WEVU_GENERIC_SLOT_OWNER_ID_PROP],
      component?.[WEVU_SLOT_OWNER_ID_PROP],
      data?.[WEVU_SLOT_OWNER_ID_KEY],
      component?.[WEVU_SLOT_OWNER_ID_KEY],
    )
  }
  const propertyOwnerId = resolveCandidate(
    instance?.properties?.[WEVU_GENERIC_SLOT_OWNER_ID_ATTR],
    instance?.properties?.[WEVU_GENERIC_SLOT_OWNER_ID_PROP],
    instance?.properties?.[WEVU_SLOT_OWNER_ID_PROP],
  )
  if (propertyOwnerId) {
    return propertyOwnerId
  }
  const owner = typeof instance?.selectOwnerComponent === 'function'
    ? instance.selectOwnerComponent()
    : undefined
  const ownerId = resolveComponentOwnerId(owner)
  if (ownerId) {
    return ownerId
  }
  const parent = typeof owner?.selectOwnerComponent === 'function'
    ? owner.selectOwnerComponent()
    : undefined
  const parentOwnerId = resolveComponentOwnerId(parent)
  if (parentOwnerId) {
    return parentOwnerId
  }
  const directOwnerId = resolveCandidate(selfCandidate)
  if (directOwnerId) {
    return directOwnerId
  }
  const fallbackOwnerId = getFallbackSlotOwnerId()
  return fallbackOwnerId && fallbackOwnerId !== ownOwnerId ? fallbackOwnerId : ''
}

function enqueueScopedSlotOwnerPropertySubscription(
  instance: any,
  ownerId: unknown,
  computedDefs?: ComputedDefinitions,
) {
  const ownOwnerId = resolveScopedSlotOwnOwnerId(instance)
  if (typeof ownerId !== 'string' || !ownerId || ownerId === ownOwnerId) {
    return
  }
  rememberSlotOwnerId(ownerId)
  enqueueScopedSlotOwnerSubscription(instance, ownerId, {}, computedDefs)
}

function resolveScopedSlotOwnerPropertyCandidate(instance: any, ...values: unknown[]) {
  const ownOwnerId = resolveScopedSlotOwnOwnerId(instance)
  for (const value of values) {
    if (typeof value === 'string' && value && value !== ownOwnerId) {
      return value
    }
  }
  return ''
}

function resolveScopedSlotOwnOwnerId(instance: any) {
  const directOwnerId = instance?.[WEVU_SLOT_OWNER_ID_KEY]
  if (typeof directOwnerId === 'string' && directOwnerId && directOwnerId !== instance?.properties?.[WEVU_SLOT_OWNER_ID_KEY]) {
    return directOwnerId
  }
  return ''
}

function enqueueScopedSlotOwnerSubscription(
  instance: any,
  ownerId: string,
  options: { preservePendingOwnerId?: boolean } = {},
  computedDefs?: ComputedDefinitions,
) {
  if (
    options.preservePendingOwnerId
    && !ownerId
    && instance.__wvOwnerSubscribeTimer
    && typeof instance.__wvOwnerPendingId === 'string'
    && instance.__wvOwnerPendingId
  ) {
    return
  }
  instance.__wvOwnerPendingId = ownerId
  if (instance.__wvOwnerSubscribeTimer) {
    return
  }
  const flush = () => {
    instance.__wvOwnerSubscribeTimer = undefined
    const pendingOwnerId = instance.__wvOwnerPendingId
    instance.__wvOwnerPendingId = undefined
    subscribeScopedSlotOwner(instance, typeof pendingOwnerId === 'string' ? pendingOwnerId : '', computedDefs)
  }
  if (typeof setTimeout === 'function') {
    instance.__wvOwnerSubscribeTimer = setTimeout(flush, 0)
  }
  else {
    flush()
  }
}

function retryScopedSlotOwnerSubscription(instance: any, computedDefs?: ComputedDefinitions, remaining = 4) {
  if (remaining <= 0 || instance.__wvOwnerIdCurrent) {
    return
  }
  const retry = () => {
    const ownerId = resolveScopedSlotOwnerId(instance)
    if (ownerId) {
      enqueueScopedSlotOwnerSubscription(instance, ownerId, { preservePendingOwnerId: true }, computedDefs)
      return
    }
    retryScopedSlotOwnerSubscription(instance, computedDefs, remaining - 1)
  }
  if (typeof setTimeout === 'function') {
    instance.__wvOwnerRetryTimer = setTimeout(retry, 16)
  }
  else {
    retry()
  }
}

export function createScopedSlotOptions(
  overrides?: { computed?: ComputedDefinitions, inlineMap?: InlineExpressionMap },
) {
  const computedKeys = Object.keys(overrides?.computed ?? {})
  const scopedSlotComputed = overrides?.computed
  const baseOptions = {
    properties: {
      [WEVU_SLOT_OWNER_ID_KEY]: {
        type: String,
        value: '',
        observer(this: any, next: unknown) {
          const ownerId = resolveScopedSlotOwnerPropertyCandidate(
            this,
            this.properties?.[WEVU_GENERIC_SLOT_OWNER_ID_ATTR],
            this.properties?.[WEVU_GENERIC_SLOT_OWNER_ID_PROP],
            this.properties?.[WEVU_SLOT_OWNER_ID_PROP],
            next,
          )
          enqueueScopedSlotOwnerPropertySubscription(this, ownerId, scopedSlotComputed)
        },
      },
      [WEVU_SLOT_OWNER_ID_PROP]: {
        type: String,
        value: '',
        observer(this: any, next: unknown) {
          const ownerId = resolveScopedSlotOwnerPropertyCandidate(
            this,
            next,
            this.properties?.[WEVU_GENERIC_SLOT_OWNER_ID_ATTR],
            this.properties?.[WEVU_GENERIC_SLOT_OWNER_ID_PROP],
            this.properties?.[WEVU_SLOT_OWNER_ID_KEY],
          )
          enqueueScopedSlotOwnerPropertySubscription(this, ownerId, scopedSlotComputed)
        },
      },
      [WEVU_GENERIC_SLOT_OWNER_ID_PROP]: {
        type: String,
        value: '',
        observer(this: any, next: unknown) {
          const ownerId = resolveScopedSlotOwnerPropertyCandidate(
            this,
            next,
            this.properties?.[WEVU_GENERIC_SLOT_OWNER_ID_ATTR],
            this.properties?.[WEVU_SLOT_OWNER_ID_PROP],
            this.properties?.[WEVU_SLOT_OWNER_ID_KEY],
          )
          enqueueScopedSlotOwnerPropertySubscription(this, ownerId, scopedSlotComputed)
        },
      },
      [WEVU_GENERIC_SLOT_OWNER_ID_ATTR]: {
        type: String,
        value: '',
        observer(this: any, next: unknown) {
          const ownerId = resolveScopedSlotOwnerPropertyCandidate(
            this,
            next,
            this.properties?.[WEVU_GENERIC_SLOT_OWNER_ID_PROP],
            this.properties?.[WEVU_SLOT_OWNER_ID_PROP],
            this.properties?.[WEVU_SLOT_OWNER_ID_KEY],
          )
          enqueueScopedSlotOwnerPropertySubscription(this, ownerId, scopedSlotComputed)
        },
      },
      [WEVU_GENERIC_SLOT_OWNER_PROPS_ATTR]: {
        type: null,
        value: null,
        observer(this: any, next: unknown) {
          syncOwnerPropsOverride(this, next)
          if (this.__wvOwnerIdCurrent) {
            const snapshot = getOwnerSnapshot(this.__wvOwnerIdCurrent) ?? {}
            syncScopedSlotOwnerSnapshot(this, snapshot, getOwnerProxy(this.__wvOwnerIdCurrent), scopedSlotComputed)
          }
        },
      },
      [WEVU_SLOT_PROPS_KEY]: {
        type: null,
        value: null,
        observer(this: any, next: unknown) {
          mergeSlotProps(this, { [WEVU_SLOT_PROPS_KEY]: next })
        },
      },
      [WEVU_GENERIC_SLOT_PROPS_PROP]: {
        type: null,
        value: null,
        observer(this: any, next: unknown) {
          mergeSlotProps(this, { [WEVU_GENERIC_SLOT_PROPS_PROP]: next })
        },
      },
      [WEVU_GENERIC_SLOT_PROPS_ATTR]: {
        type: null,
        value: null,
        observer(this: any, next: unknown) {
          mergeSlotProps(this, { [WEVU_GENERIC_SLOT_PROPS_ATTR]: next })
        },
      },
      [WEVU_GENERIC_SLOT_PROPS_DATA_ATTR]: {
        type: null,
        value: null,
        observer(this: any, next: unknown) {
          syncSlotPropsDataSource(this, next)
        },
      },
      [WEVU_SLOT_SCOPE_KEY]: {
        type: null,
        value: null,
        observer(this: any, next: unknown) {
          mergeSlotProps(this, { [WEVU_SLOT_SCOPE_KEY]: next })
        },
      },
      [WEVU_GENERIC_SLOT_SCOPE_PROP]: {
        type: null,
        value: null,
        observer(this: any, next: unknown) {
          mergeSlotProps(this, { [WEVU_GENERIC_SLOT_SCOPE_PROP]: next })
        },
      },
      [WEVU_GENERIC_SLOT_SCOPE_ATTR]: {
        type: null,
        value: null,
        observer(this: any, next: unknown) {
          mergeSlotProps(this, { [WEVU_GENERIC_SLOT_SCOPE_ATTR]: next })
        },
      },
    },
    data: () => {
      const initialData: Record<string, any> = {
        [WEVU_SLOT_OWNER_KEY]: {},
        [WEVU_GENERIC_SLOT_OWNER_DATA_KEY]: {},
        [WEVU_SLOT_PROPS_DATA_KEY]: {},
        [WEVU_GENERIC_SLOT_PROPS_DATA_KEY]: {},
      }
      for (const key of computedKeys) {
        initialData[key] = null
      }
      return initialData
    },
    options: {
      virtualHost: true,
    },
    setData: computedKeys.length
      ? {
          includeComputed: true,
          pick: [
            ...computedKeys,
            WEVU_SLOT_OWNER_KEY,
            WEVU_GENERIC_SLOT_OWNER_DATA_KEY,
            WEVU_SLOT_PROPS_DATA_KEY,
            WEVU_GENERIC_SLOT_PROPS_DATA_KEY,
          ],
        }
      : undefined,
    lifetimes: {
      attached(this: any) {
        const ownerId = resolveScopedSlotOwnerId(this)
        mergeSlotProps(this)
        syncOwnerPropsOverride(this)
        syncOwnerComponentScopedSlotState(this)
        enqueueScopedSlotOwnerSubscription(this, ownerId, { preservePendingOwnerId: true }, scopedSlotComputed)
        if (!ownerId) {
          retryScopedSlotOwnerSubscription(this, scopedSlotComputed)
        }
      },
      ready(this: any) {
        const ownerId = resolveScopedSlotOwnerId(this)
        mergeSlotProps(this)
        syncOwnerPropsOverride(this)
        syncOwnerComponentScopedSlotState(this)
        enqueueScopedSlotOwnerSubscription(this, ownerId, { preservePendingOwnerId: true }, scopedSlotComputed)
        if (!ownerId) {
          retryScopedSlotOwnerSubscription(this, scopedSlotComputed)
        }
      },
      detached(this: any) {
        if (typeof this.__wvOwnerUnsub === 'function') {
          this.__wvOwnerUnsub()
        }
        if (this.__wvOwnerSubscribeTimer && typeof clearTimeout === 'function') {
          clearTimeout(this.__wvOwnerSubscribeTimer)
        }
        if (this.__wvOwnerSyncTimer && typeof clearTimeout === 'function') {
          clearTimeout(this.__wvOwnerSyncTimer)
        }
        if (this.__wvOwnerRetryTimer && typeof clearTimeout === 'function') {
          clearTimeout(this.__wvOwnerRetryTimer)
        }
        this.__wvOwnerUnsub = undefined
        this.__wvOwnerIdCurrent = undefined
        this.__wvOwnerSubscribeTimer = undefined
        this.__wvOwnerPendingId = undefined
        this.__wvOwnerSyncTimer = undefined
        this.__wvOwnerPendingSnapshot = undefined
        this.__wvOwnerPendingProxy = undefined
        this.__wvOwnerRetryTimer = undefined
        this[SLOT_OWNER_PROXY_KEY] = undefined
        this[OWNER_PROPS_OVERRIDE_KEY] = undefined
        this[SLOT_PROPS_OVERRIDE_KEY] = undefined
        this[SLOT_SCOPE_OVERRIDE_KEY] = undefined
      },
    },
    methods: {
      [WEVU_OWNER_HANDLER](this: any, event: any) {
        const owner = this[SLOT_OWNER_PROXY_KEY]
        const inlineMap = (this as any).__wevu?.methods?.[WEVU_INLINE_MAP_KEY]
        const dataset = event?.currentTarget?.dataset ?? event?.target?.dataset ?? {}
        const inlineId = resolveDatasetEventValue(dataset, 'wvInlineId', event)
        if (inlineId && inlineMap) {
          return runInlineExpression(owner, undefined, event, inlineMap)
        }
        if (!owner) {
          return undefined
        }
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

  return baseOptions
}
