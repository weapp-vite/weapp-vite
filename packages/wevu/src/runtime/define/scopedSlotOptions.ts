import type { ComputedDefinitions } from '../types'
import { getOwnerProxy, getOwnerSnapshot, subscribeOwner } from '../scopedSlots'

function decodeWxmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&#39;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function parseInlineArgs(event: any) {
  const argsRaw = event?.currentTarget?.dataset?.wvArgs ?? event?.target?.dataset?.wvArgs
  let args: any[] = []
  if (typeof argsRaw === 'string') {
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
  const scopeSource = Object.prototype.hasOwnProperty.call(override ?? {}, '__wvSlotScope')
    ? (override as any).__wvSlotScope
    : instance?.properties?.__wvSlotScope
  const propsSource = Object.prototype.hasOwnProperty.call(override ?? {}, '__wvSlotProps')
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
  overrides?: { computed?: ComputedDefinitions },
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
        const handlerName = event?.currentTarget?.dataset?.wvHandler ?? event?.target?.dataset?.wvHandler
        if (typeof handlerName !== 'string' || !handlerName) {
          return undefined
        }
        const owner = this.__wvOwnerProxy
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

  return baseOptions
}
