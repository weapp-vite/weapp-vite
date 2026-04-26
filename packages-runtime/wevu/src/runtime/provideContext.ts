import type { InternalRuntimeState, RuntimeApp } from './types'
import {
  WEVU_APP_PROVIDES_KEY,
  WEVU_IS_APP_INSTANCE_KEY,
  WEVU_PARENT_INSTANCE_KEY,
  WEVU_PROVIDES_KEY,
  WEVU_RUNTIME_APP_KEY,
} from '@weapp-core/constants'
import { setGlobalProvidedValue } from './provideStore'

export function isRuntimeAppInstance(instance: unknown): boolean {
  return Boolean(
    instance
    && typeof instance === 'object'
    && (instance as { [WEVU_IS_APP_INSTANCE_KEY]?: boolean })[WEVU_IS_APP_INSTANCE_KEY] === true,
  )
}

function createProvides(parent?: Record<PropertyKey, any>) {
  return Object.create(parent ?? null) as Record<PropertyKey, any>
}

function getRuntimeAppProvides(runtimeApp: RuntimeApp<any, any, any> | undefined): Record<PropertyKey, any> {
  if (!runtimeApp) {
    return createProvides()
  }
  const existing = runtimeApp[WEVU_APP_PROVIDES_KEY]
  if (existing && typeof existing === 'object') {
    return existing
  }
  const provides = createProvides()
  try {
    Object.defineProperty(runtimeApp, WEVU_APP_PROVIDES_KEY, {
      value: provides,
      configurable: true,
      enumerable: false,
      writable: false,
    })
  }
  catch {
    ;(runtimeApp as any)[WEVU_APP_PROVIDES_KEY] = provides
  }
  return provides
}

export function attachInstanceProvides(
  instance: InternalRuntimeState,
  provides: Record<PropertyKey, any>,
): void {
  try {
    Object.defineProperty(instance, WEVU_PROVIDES_KEY, {
      value: provides,
      configurable: true,
      enumerable: false,
      writable: true,
    })
  }
  catch {
    ;(instance as any)[WEVU_PROVIDES_KEY] = provides
  }
}

export function getInstanceProvides(instance: InternalRuntimeState): Record<PropertyKey, any> {
  const existing = instance[WEVU_PROVIDES_KEY]
  if (existing && typeof existing === 'object') {
    return existing
  }

  const runtimeApp = instance[WEVU_RUNTIME_APP_KEY]
  const parentProvides = instance[WEVU_PARENT_INSTANCE_KEY]?.[WEVU_PROVIDES_KEY]
    ?? getRuntimeAppProvides(runtimeApp)
  const provides = isRuntimeAppInstance(instance)
    ? getRuntimeAppProvides(runtimeApp)
    : createProvides(parentProvides)
  attachInstanceProvides(instance, provides)
  return provides
}

export function ensureRuntimeAppProvides(runtimeApp: RuntimeApp<any, any, any>): Record<PropertyKey, any> {
  return getRuntimeAppProvides(runtimeApp)
}

export function setRuntimeAppProvidedValue<T>(runtimeApp: RuntimeApp<any, any, any>, key: any, value: T): void {
  getRuntimeAppProvides(runtimeApp)[key as PropertyKey] = value
  setGlobalProvidedValue(key, value)
}

export function attachRuntimeProvideContext(
  instance: InternalRuntimeState,
  runtimeApp: RuntimeApp<any, any, any>,
  parentInstance?: InternalRuntimeState,
): void {
  const appProvides = getRuntimeAppProvides(runtimeApp)
  const parentProvides = parentInstance?.[WEVU_PROVIDES_KEY] ?? appProvides
  const provides = isRuntimeAppInstance(instance)
    ? appProvides
    : createProvides(parentProvides)

  if (parentInstance) {
    try {
      Object.defineProperty(instance, WEVU_PARENT_INSTANCE_KEY, {
        value: parentInstance,
        configurable: true,
        enumerable: false,
        writable: true,
      })
    }
    catch {
      ;(instance as any)[WEVU_PARENT_INSTANCE_KEY] = parentInstance
    }
  }

  attachInstanceProvides(instance, provides)
}

function isPrototypeInChain(target: Record<PropertyKey, any>, candidate: Record<PropertyKey, any>) {
  let current = Object.getPrototypeOf(target)
  while (current) {
    if (current === candidate) {
      return true
    }
    current = Object.getPrototypeOf(current)
  }
  return false
}

export function attachRuntimeLayoutProvideContext(
  layoutInstance: InternalRuntimeState,
  pageInstance: InternalRuntimeState,
): void {
  const layoutProvides = getInstanceProvides(layoutInstance)
  const pageProvides = getInstanceProvides(pageInstance)
  if (
    layoutProvides === pageProvides
    || isPrototypeInChain(layoutProvides, pageProvides)
    || isPrototypeInChain(pageProvides, layoutProvides)
  ) {
    return
  }

  Object.setPrototypeOf(pageProvides, layoutProvides)

  try {
    Object.defineProperty(pageInstance, WEVU_PARENT_INSTANCE_KEY, {
      value: layoutInstance,
      configurable: true,
      enumerable: false,
      writable: true,
    })
  }
  catch {
    ;(pageInstance as any)[WEVU_PARENT_INSTANCE_KEY] = layoutInstance
  }
}
