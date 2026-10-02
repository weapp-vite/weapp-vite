import type {
  ComponentOptions,
  DataRecord,
  DefineComponentOptions,
  LifeTimeHooks,
  NormalizedComponentOptions,
  PageLifeTimeHooks,
  PropertyDeclaration,
  PropertyOption,
} from './types'
import { hasOwn } from '../utils/object'
import { normalizeBehaviors } from './behavior'
import { cloneValue, hyphenate } from './utils'

type PropertyEntry = [string, PropertyOption]

export interface ComponentRuntimeState {
  id?: string
  templateRef: DefineComponentOptions['template']
  styleRef: string
  inheritAppStyle: boolean
  componentRef: NormalizedComponentOptions
  observerInitEnabled: boolean
  propertyEntries: PropertyEntry[]
  observedAttributes: string[]
  defaultPropertyValues: DataRecord
  lifetimes: LifeTimeHooks
  pageLifetimes: PageLifeTimeHooks
}

function normalizePropertyDeclaration(declaration: PropertyDeclaration): PropertyOption {
  if (declaration === null || typeof declaration === 'function') {
    return { type: declaration }
  }
  return declaration
}

function resolveNormalizedComponent(component: ComponentOptions) {
  const normalized = normalizeBehaviors(component)
  const resolved = normalized.component!
  return {
    warnings: normalized.warnings,
    component: {
      ...resolved,
      properties: Object.fromEntries(
        Object.entries(resolved.properties ?? {}).map(([name, declaration]) => [
          name,
          normalizePropertyDeclaration(declaration),
        ]),
      ),
    } satisfies NormalizedComponentOptions,
  }
}

function createDefaultPropertyValues(propertyEntries: PropertyEntry[]) {
  return propertyEntries.reduce<DataRecord>((acc, [name, prop]) => {
    if (prop !== null && typeof prop === 'object' && hasOwn(prop, 'value')) {
      acc[name] = cloneValue(prop.value)
    }
    else {
      acc[name] = undefined
    }
    return acc
  }, {})
}

function createPropertyEntries(component: NormalizedComponentOptions): PropertyEntry[] {
  return Object.entries(component.properties)
}

function createObservedAttributes(propertyEntries: PropertyEntry[]) {
  return propertyEntries.map(([name]) => hyphenate(name))
}

function inheritsAppStyle(kind: DefineComponentOptions['kind'], component: NormalizedComponentOptions) {
  if (kind === 'page') {
    return true
  }
  const { styleIsolation, addGlobalClass } = component.options ?? {}
  return styleIsolation === undefined ? Boolean(addGlobalClass) : styleIsolation !== 'isolated'
}

export function createComponentRuntimeState(options: DefineComponentOptions) {
  const { component, warnings } = resolveNormalizedComponent(options.component ?? {})
  const propertyEntries = createPropertyEntries(component)
  const state: ComponentRuntimeState = {
    id: options.id,
    templateRef: options.template,
    styleRef: options.style ?? '',
    inheritAppStyle: inheritsAppStyle(options.kind, component),
    componentRef: component,
    observerInitEnabled: Boolean(options.observerInit),
    propertyEntries,
    observedAttributes: createObservedAttributes(propertyEntries),
    defaultPropertyValues: createDefaultPropertyValues(propertyEntries),
    lifetimes: component.lifetimes ?? {},
    pageLifetimes: component.pageLifetimes ?? {},
  }
  return {
    state,
    warnings,
  }
}

export function updateComponentRuntimeState(state: ComponentRuntimeState, options: DefineComponentOptions) {
  const { component, warnings } = resolveNormalizedComponent(options.component ?? {})
  const propertyEntries = createPropertyEntries(component)
  state.templateRef = options.template
  state.id = options.id
  state.styleRef = options.style ?? ''
  state.inheritAppStyle = inheritsAppStyle(options.kind, component)
  state.componentRef = component
  state.observerInitEnabled = Boolean(options.observerInit)
  state.lifetimes = component.lifetimes ?? {}
  state.pageLifetimes = component.pageLifetimes ?? {}
  state.propertyEntries = propertyEntries
  state.observedAttributes = createObservedAttributes(propertyEntries)
  state.defaultPropertyValues = createDefaultPropertyValues(propertyEntries)
  return {
    warnings,
    nextMethods: component.methods ?? {},
  }
}
