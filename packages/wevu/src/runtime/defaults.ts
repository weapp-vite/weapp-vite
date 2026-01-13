import type { CreateAppOptions, DefineComponentOptions } from './types'

export type WevuDefaultsScope = 'app' | 'component'

export const INTERNAL_DEFAULTS_SCOPE_KEY = '__wevuDefaultsScope'

export interface WevuDefaults {
  app?: Partial<CreateAppOptions<any, any, any>>
  component?: Partial<DefineComponentOptions<any, any, any, any>>
}

let currentDefaults: WevuDefaults = {}

function getPlainRecord(value: unknown): Record<string, any> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  return value as Record<string, any>
}

function mergeDefaults<T extends Record<string, any>>(
  defaults?: Partial<T>,
  options?: Partial<T>,
) {
  if (!defaults) {
    return options
  }
  if (!options) {
    return defaults
  }

  const merged = {
    ...(defaults as Record<string, any>),
    ...(options as Record<string, any>),
  }

  const defaultSetData = getPlainRecord((defaults as any).setData)
  const optionSetData = getPlainRecord((options as any).setData)
  if (defaultSetData || optionSetData) {
    merged.setData = {
      ...(defaultSetData ?? {}),
      ...(optionSetData ?? {}),
    }
  }

  const defaultOptions = getPlainRecord((defaults as any).options)
  const optionOptions = getPlainRecord((options as any).options)
  if (defaultOptions || optionOptions) {
    merged.options = {
      ...(defaultOptions ?? {}),
      ...(optionOptions ?? {}),
    }
  }

  return merged as Partial<T>
}

function mergeWithDefaults<T extends Record<string, any>>(
  defaults: Partial<T> | undefined,
  options: T,
): T {
  return mergeDefaults(defaults, options) as T
}

function mergeWevuDefaults(base: WevuDefaults, next: WevuDefaults): WevuDefaults {
  return {
    app: mergeDefaults(base.app, next.app),
    component: mergeDefaults(base.component, next.component),
  }
}

export function setWevuDefaults(next: WevuDefaults) {
  currentDefaults = mergeWevuDefaults(currentDefaults, next)
}

export function resetWevuDefaults() {
  currentDefaults = {}
}

export function resolveWevuDefaults() {
  return currentDefaults
}

export function applyWevuAppDefaults<T extends CreateAppOptions<any, any, any>>(options: T): T {
  return mergeWithDefaults(currentDefaults.app as Partial<T> | undefined, options)
}

export function applyWevuComponentDefaults<T extends DefineComponentOptions<any, any, any, any>>(options: T): T {
  return mergeWithDefaults(currentDefaults.component as Partial<T> | undefined, options)
}
