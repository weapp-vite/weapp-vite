import type { InlineExpressionMap } from '../register/inline'
import type { ComputedDefinitions } from '../types'
import {
  WEVU_INLINE_MAP_KEY,
  WEVU_OWNER_HANDLER,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_KEY,
  WEVU_SLOT_PROPS_DATA_KEY,
  WEVU_SLOT_PROPS_KEY,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'
import { resolveDatasetEventValue, runInlineExpression } from '../register/inline'
import { getOwnerProxy, getOwnerSnapshot, subscribeOwner } from '../scopedSlots'

const AMP_RE = /&amp;/g
const QUOT_RE = /&quot;/g
const NUM_QUOT_RE = /&#34;/g
const APOS_RE = /&apos;/g
const NUM_APOS_RE = /&#39;/g
const LT_RE = /&lt;/g
const GT_RE = /&gt;/g

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
  override?: { [WEVU_SLOT_SCOPE_KEY]?: unknown, [WEVU_SLOT_PROPS_KEY]?: unknown },
) {
  const scopeSource = Object.hasOwn(override ?? {}, WEVU_SLOT_SCOPE_KEY)
    ? (override as any)[WEVU_SLOT_SCOPE_KEY]
    : instance?.properties?.[WEVU_SLOT_SCOPE_KEY]
  const propsSource = Object.hasOwn(override ?? {}, WEVU_SLOT_PROPS_KEY)
    ? (override as any)[WEVU_SLOT_PROPS_KEY]
    : instance?.properties?.[WEVU_SLOT_PROPS_KEY]
  const scope = normalizeSlotBindings(scopeSource)
  const slotProps = normalizeSlotBindings(propsSource)
  const merged = { ...scope, ...slotProps }
  if (typeof instance?.setData === 'function') {
    instance.setData({ [WEVU_SLOT_PROPS_DATA_KEY]: merged })
  }
}

export function createScopedSlotOptions(
  overrides?: { computed?: ComputedDefinitions, inlineMap?: InlineExpressionMap },
) {
  const baseOptions = {
    properties: {
      [WEVU_SLOT_OWNER_ID_KEY]: { type: String, value: '' },
      [WEVU_SLOT_PROPS_KEY]: {
        type: null,
        value: null,
        observer(this: any, next: unknown) {
          mergeSlotProps(this, { [WEVU_SLOT_PROPS_KEY]: next })
        },
      },
      [WEVU_SLOT_SCOPE_KEY]: {
        type: null,
        value: null,
        observer(this: any, next: unknown) {
          mergeSlotProps(this, { [WEVU_SLOT_SCOPE_KEY]: next })
        },
      },
    },
    data: () => ({
      [WEVU_SLOT_OWNER_KEY]: {},
      [WEVU_SLOT_PROPS_DATA_KEY]: {},
    }),
    lifetimes: {
      attached(this: any) {
        const ownerId = this.properties?.[WEVU_SLOT_OWNER_ID_KEY] ?? ''
        mergeSlotProps(this)
        if (!ownerId) {
          return
        }
        const updateOwner = (snapshot: Record<string, any>, proxy: any) => {
          this.__wvOwnerProxy = proxy
          if (typeof this.setData === 'function') {
            this.setData({ [WEVU_SLOT_OWNER_KEY]: snapshot || {} })
          }
        }
        this.__wvOwnerUnsub = subscribeOwner(ownerId, updateOwner)
        const snapshot = getOwnerSnapshot(ownerId)
        if (snapshot) {
          updateOwner(snapshot, getOwnerProxy(ownerId))
        }
      },
      detached(this: any) {
        if (typeof this.__wvOwnerUnsub === 'function') {
          this.__wvOwnerUnsub()
        }
        this.__wvOwnerUnsub = undefined
        this.__wvOwnerProxy = undefined
      },
    },
    methods: {
      [WEVU_OWNER_HANDLER](this: any, event: any) {
        const owner = this.__wvOwnerProxy
        const inlineMap = (this as any).__wevu?.methods?.[WEVU_INLINE_MAP_KEY]
        const result = runInlineExpression(owner, undefined, event, inlineMap)
        if (result !== undefined) {
          return result
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

  return baseOptions
}
