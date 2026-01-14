import type { WevuDefaults } from 'wevu'
import type { TransformScriptOptions } from '../utils'
import * as t from '@babel/types'
import { WE_VU_RUNTIME_APIS } from 'wevu/compiler'
import logger from '../../../../../logger'
import { ensureRuntimeImport } from '../../scriptRuntimeImport'
import { createStaticObjectKey, getObjectPropertyByKey, isPlainRecord } from '../utils'

function mergePlainDefaultsIntoObjectExpression(
  target: t.ObjectExpression,
  defaults: Record<string, any>,
): boolean {
  const entries = Object.entries(defaults)
  if (!entries.length) {
    return false
  }
  let changed = false
  const injectedProps: t.ObjectProperty[] = []

  for (const [key, value] of entries) {
    if (getObjectPropertyByKey(target, key)) {
      continue
    }
    injectedProps.push(t.objectProperty(createStaticObjectKey(key), t.valueToNode(value)))
  }

  if (!injectedProps.length) {
    return false
  }

  target.properties.splice(0, 0, ...injectedProps)
  changed = true

  return changed
}

function mergeNestedDefaults(
  optionsObject: t.ObjectExpression,
  key: 'options' | 'setData',
  defaultsValue: unknown,
): boolean {
  if (!isPlainRecord(defaultsValue)) {
    if (defaultsValue === undefined) {
      return false
    }
    const existing = getObjectPropertyByKey(optionsObject, key)
    if (existing) {
      return false
    }
    optionsObject.properties.splice(
      0,
      0,
      t.objectProperty(createStaticObjectKey(key), t.valueToNode(defaultsValue)),
    )
    return true
  }

  const existing = getObjectPropertyByKey(optionsObject, key)
  if (!existing) {
    optionsObject.properties.splice(
      0,
      0,
      t.objectProperty(createStaticObjectKey(key), t.valueToNode(defaultsValue)),
    )
    return true
  }

  if (t.isObjectExpression(existing.value)) {
    return mergePlainDefaultsIntoObjectExpression(existing.value, defaultsValue)
  }

  if (t.isIdentifier(existing.value) || t.isMemberExpression(existing.value)) {
    const injected = t.valueToNode(defaultsValue)
    if (t.isObjectExpression(injected)) {
      injected.properties.push(t.spreadElement(t.cloneNode(existing.value, true)))
      existing.value = injected
      return true
    }
  }

  return false
}

export function applyWevuDefaultsToOptionsObject(
  optionsObject: t.ObjectExpression,
  defaults: Record<string, any>,
): boolean {
  let changed = false
  for (const [key, value] of Object.entries(defaults)) {
    if (key === 'setData' || key === 'options') {
      changed = mergeNestedDefaults(optionsObject, key, value) || changed
      continue
    }
    if (value === undefined || getObjectPropertyByKey(optionsObject, key)) {
      continue
    }
    optionsObject.properties.splice(
      0,
      0,
      t.objectProperty(createStaticObjectKey(key), t.valueToNode(value)),
    )
    changed = true
  }
  return changed
}

export function ensureNestedOptionValue(
  optionsObject: t.ObjectExpression,
  key: 'options' | 'setData',
  nestedKey: string,
  value: unknown,
): boolean {
  const existing = getObjectPropertyByKey(optionsObject, key)
  if (!existing) {
    const nested = t.objectExpression([
      t.objectProperty(createStaticObjectKey(nestedKey), t.valueToNode(value)),
    ])
    optionsObject.properties.splice(
      0,
      0,
      t.objectProperty(createStaticObjectKey(key), nested),
    )
    return true
  }

  if (t.isObjectExpression(existing.value)) {
    if (getObjectPropertyByKey(existing.value, nestedKey)) {
      return false
    }
    existing.value.properties.splice(
      0,
      0,
      t.objectProperty(createStaticObjectKey(nestedKey), t.valueToNode(value)),
    )
    return true
  }

  if (t.isIdentifier(existing.value) || t.isMemberExpression(existing.value)) {
    const wrapped = t.objectExpression([
      t.objectProperty(createStaticObjectKey(nestedKey), t.valueToNode(value)),
      t.spreadElement(t.cloneNode(existing.value, true)),
    ])
    existing.value = wrapped
    return true
  }

  return false
}

export function stripVirtualHostFromDefaults(defaults: Record<string, any>): Record<string, any> {
  const next = { ...defaults }
  const options = next.options
  if (!isPlainRecord(options)) {
    return next
  }
  if (!Object.prototype.hasOwnProperty.call(options, 'virtualHost')) {
    return next
  }
  const copiedOptions = { ...options }
  delete copiedOptions.virtualHost
  if (Object.keys(copiedOptions).length > 0) {
    next.options = copiedOptions
  }
  else {
    delete next.options
  }
  return next
}

export function serializeWevuDefaults(defaults: WevuDefaults): string | undefined {
  const seen = new Set<unknown>()
  try {
    return JSON.stringify(defaults, (_key, value) => {
      if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
        throw new TypeError('Wevu defaults must be JSON-serializable')
      }
      if (value && typeof value === 'object') {
        if (seen.has(value)) {
          throw new Error('Wevu defaults must not be circular')
        }
        seen.add(value)
        if (!Array.isArray(value) && !isPlainRecord(value)) {
          throw new Error('Wevu defaults must be plain objects or arrays')
        }
      }
      return value
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn(`[vue] Failed to serialize wevu defaults: ${message}`)
    return undefined
  }
}

export function insertWevuDefaultsCall(program: t.Program, serializedDefaults: string) {
  const callStatement = t.expressionStatement(
    t.callExpression(t.identifier(WE_VU_RUNTIME_APIS.setWevuDefaults), [
      t.valueToNode(JSON.parse(serializedDefaults)),
    ]),
  )
  let insertIndex = 0
  while (insertIndex < program.body.length && t.isImportDeclaration(program.body[insertIndex])) {
    insertIndex += 1
  }
  program.body.splice(insertIndex, 0, callStatement)
}

export function applyWevuDefaultsToComponentOptions(params: {
  componentExpr: t.ObjectExpression
  parsedWevuDefaults: WevuDefaults
  options: TransformScriptOptions | undefined
}) {
  const { componentExpr, parsedWevuDefaults, options } = params
  let changed = false

  if (options?.isApp && parsedWevuDefaults.app && Object.keys(parsedWevuDefaults.app).length > 0) {
    changed = applyWevuDefaultsToOptionsObject(componentExpr, parsedWevuDefaults.app) || changed
  }

  if (!options?.isApp && parsedWevuDefaults.component && Object.keys(parsedWevuDefaults.component).length > 0) {
    const componentDefaults = options?.isPage
      ? stripVirtualHostFromDefaults(parsedWevuDefaults.component as Record<string, any>)
      : (parsedWevuDefaults.component as Record<string, any>)
    if (Object.keys(componentDefaults).length > 0) {
      changed = applyWevuDefaultsToOptionsObject(componentExpr, componentDefaults) || changed
    }
  }

  const componentOptionDefaults = parsedWevuDefaults.component?.options
  if (
    options?.isPage
    && isPlainRecord(componentOptionDefaults)
    && componentOptionDefaults.virtualHost === true
  ) {
    changed = ensureNestedOptionValue(componentExpr, 'options', 'virtualHost', false) || changed
  }

  return changed
}

export function injectWevuDefaultsForApp(params: {
  astProgram: t.Program
  options: TransformScriptOptions | undefined
  serializedWevuDefaults: string | undefined
}) {
  const { astProgram, options, serializedWevuDefaults } = params
  let changed = false

  if (options?.isApp && serializedWevuDefaults) {
    ensureRuntimeImport(astProgram, WE_VU_RUNTIME_APIS.setWevuDefaults)
    insertWevuDefaultsCall(astProgram, serializedWevuDefaults)
    changed = true
  }

  return changed
}
