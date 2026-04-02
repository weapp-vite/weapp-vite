import type { InlineExpressionMap } from '../register/inline'
import type { ComputedDefinitions } from '../types'
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
  override?: { __wvSlotScope?: unknown, __wvSlotProps?: unknown },
) {
  const scopeSource = Object.hasOwn(override ?? {}, '__wvSlotScope')
    ? (override as any).__wvSlotScope
    : instance?.properties?.__wvSlotScope
  const propsSource = Object.hasOwn(override ?? {}, '__wvSlotProps')
    ? (override as any).__wvSlotProps
    : instance?.properties?.__wvSlotProps
  const scope = normalizeSlotBindings(scopeSource)
  const slotProps = normalizeSlotBindings(propsSource)
  const merged = { ...scope, ...slotProps }
  if (typeof instance?.setData === 'function') {
    instance.setData({ __wvSlotPropsData: merged })
  }
}

export function createScopedSlotOptions(
  overrides?: { computed?: ComputedDefinitions, inlineMap?: InlineExpressionMap },
) {
  const baseOptions = {
    properties: {
      __wvOwnerId: { type: String, value: '' },
      __wvSlotProps: {
        type: null,
        value: null,
        observer(this: any, next: unknown) {
          mergeSlotProps(this, { __wvSlotProps: next })
        },
      },
      __wvSlotScope: {
        type: null,
        value: null,
        observer(this: any, next: unknown) {
          mergeSlotProps(this, { __wvSlotScope: next })
        },
      },
    },
    data: () => ({
      __wvOwner: {},
      __wvSlotPropsData: {},
    }),
    lifetimes: {
      attached(this: any) {
        const ownerId = this.properties?.__wvOwnerId ?? ''
        mergeSlotProps(this)
        if (!ownerId) {
          return
        }
        const updateOwner = (snapshot: Record<string, any>, proxy: any) => {
          this.__wvOwnerProxy = proxy
          if (typeof this.setData === 'function') {
            this.setData({ __wvOwner: snapshot || {} })
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
      __weapp_vite_owner(this: any, event: any) {
        const owner = this.__wvOwnerProxy
        const inlineMap = (this as any).__wevu?.methods?.__weapp_vite_inline_map
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
      __weapp_vite_inline_map: overrides.inlineMap,
    }
  }

  return baseOptions
}
