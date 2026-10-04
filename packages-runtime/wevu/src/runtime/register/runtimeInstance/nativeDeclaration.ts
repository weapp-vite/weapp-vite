import type { InternalRuntimeState } from '../../types'
import {
  WEVU_NATIVE_DECLARATION_ADDRESS_PROP,
  WEVU_NATIVE_DECLARATION_EVENT,
  WEVU_NATIVE_SLOT_CONTEXT_KEY,
} from '@weapp-core/constants'

const addressKey = /* @__PURE__ */ Symbol('native-declaration-address')
const registrationKey = /* @__PURE__ */ Symbol('native-declaration-registration')
const indexKey = /* @__PURE__ */ Symbol('native-declaration-index')

type ImportMetaWithEnv = ImportMeta & { env?: { PLATFORM?: string } }
type NativeDeclarationAddress = readonly [selfKey: string, parentKey: string]
type DeclarationHost = InternalRuntimeState & {
  [addressKey]?: NativeDeclarationAddress | null
  [registrationKey]?: NativeDeclarationRegistration
  [indexKey]?: Map<string, NativeDeclarationRegistration>
}

interface NativeDeclarationRegistration {
  owner: DeclarationHost
  target: DeclarationHost
  selfKey: string
}

interface NativeDeclarationDetail {
  register: (owner: InternalRuntimeState) => void
}

export function usesNativeSlotContext(target: object) {
  const platform = (import.meta as ImportMetaWithEnv).env?.PLATFORM
  return (!platform || platform === 'weapp') && (target as Record<string, unknown>)[WEVU_NATIVE_SLOT_CONTEXT_KEY] === true
}

function parseAddress(value: unknown): NativeDeclarationAddress | undefined {
  return Array.isArray(value) && value.length === 2
    && typeof value[0] === 'string' && value[0] !== '' && typeof value[1] === 'string'
    ? value as unknown as NativeDeclarationAddress
    : undefined
}

function readAddress(target: DeclarationHost) {
  return target[addressKey] === undefined
    ? parseAddress(target.properties?.[WEVU_NATIVE_DECLARATION_ADDRESS_PROP])
    : target[addressKey] ?? undefined
}

function removeRegistration(registration: NativeDeclarationRegistration) {
  const { owner, target, selfKey } = registration
  if (owner[indexKey]?.get(selfKey) === registration) {
    owner[indexKey]?.delete(selfKey)
  }
  if (target[registrationKey] === registration) {
    delete target[registrationKey]
  }
}

function installRegistration(registration: NativeDeclarationRegistration) {
  const { owner, target, selfKey } = registration
  const index = owner[indexKey] ??= new Map()
  const previous = index.get(selfKey)
  // 原生替换允许先 attached 后 detached；旧实例不能删掉或重新索引替代者。
  if (previous && previous !== registration) {
    removeRegistration(previous)
  }
  index.set(selfKey, registration)
  target[registrationKey] = registration
}

export function updateNativeDeclarationAddress(target: DeclarationHost, newValue: unknown) {
  const address = parseAddress(newValue)
  target[addressKey] = address ?? null
  const registration = target[registrationKey]
  if (!registration || registration.selfKey === address?.[0]) {
    return
  }
  removeRegistration(registration)
  if (address) {
    registration.selfKey = address[0]
    installRegistration(registration)
  }
}

export function resolveNativeDeclarationHost(owner: DeclarationHost, key: string): InternalRuntimeState | undefined {
  return key ? owner[indexKey]?.get(key)?.target : owner
}

/** 编译后的直接事件必须在原生方法 this 上注册，不能经过公开 export 或 setup 方法代理。 */
export function receiveNativeDeclaration(this: InternalRuntimeState, event: { detail?: NativeDeclarationDetail }) {
  if (typeof event.detail?.register === 'function') {
    event.detail.register(this)
  }
}

export function resolveNativeDeclarationParent(target: DeclarationHost): InternalRuntimeState | undefined {
  const address = readAddress(target)
  if (!address || typeof target.triggerEvent !== 'function') {
    return undefined
  }
  let parent: InternalRuntimeState | undefined
  target.triggerEvent(WEVU_NATIVE_DECLARATION_EVENT, {
    register(owner: DeclarationHost) {
      if (owner === target) {
        return
      }
      const previous = target[registrationKey]
      if (previous) {
        removeRegistration(previous)
      }
      installRegistration({ owner, target, selfKey: address[0] })
      parent = resolveNativeDeclarationHost(owner, address[1])
    },
  } satisfies NativeDeclarationDetail, { bubbles: false, composed: false })
  return parent
}

export function releaseNativeDeclaration(target: DeclarationHost, preserveOwnerIndex = false) {
  const registration = target[registrationKey]
  if (registration) {
    removeRegistration(registration)
  }
  if (preserveOwnerIndex) {
    return
  }
  const index = target[indexKey]
  if (index) {
    for (const child of index.values()) {
      removeRegistration(child)
    }
    delete target[indexKey]
  }
  delete target[addressKey]
}
