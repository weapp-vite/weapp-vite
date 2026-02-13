import type {
  ComponentOptions,
  DataRecord,
  DefineComponentOptions,
  LifeTimeHooks,
  PageLifeTimeHooks,
  PropertyOption,
} from './types'
import { normalizeBehaviors } from './behavior'
import { cloneValue, hyphenate } from './utils'

type PropertyEntry = [string, PropertyOption]

export interface ComponentRuntimeState {
  templateRef: DefineComponentOptions['template']
  styleRef: string
  componentRef: ComponentOptions
  observerInitEnabled: boolean
  propertyEntries: PropertyEntry[]
  observedAttributes: string[]
  defaultPropertyValues: DataRecord
  lifetimes: LifeTimeHooks
  pageLifetimes: PageLifeTimeHooks
}

function resolveNormalizedComponent(component: ComponentOptions | undefined) {
  const normalized = normalizeBehaviors(component)
  return {
    warnings: normalized.warnings,
    component: normalized.component ?? component ?? {},
  }
}

function createDefaultPropertyValues(propertyEntries: PropertyEntry[]) {
  return propertyEntries.reduce<DataRecord>((acc, [name, prop]) => {
    if (Object.prototype.hasOwnProperty.call(prop, 'value')) {
      acc[name] = cloneValue(prop.value)
    }
    else {
      acc[name] = undefined
    }
    return acc
  }, {})
}

function createPropertyEntries(component: ComponentOptions): PropertyEntry[] {
  return Object.entries(component.properties ?? {})
}

function createObservedAttributes(propertyEntries: PropertyEntry[]) {
  return propertyEntries.map(([name]) => hyphenate(name))
}

export function createComponentRuntimeState(options: DefineComponentOptions) {
  const { component, warnings } = resolveNormalizedComponent(options.component ?? {})
  const propertyEntries = createPropertyEntries(component)
  const state: ComponentRuntimeState = {
    templateRef: options.template,
    styleRef: options.style ?? '',
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
  state.styleRef = options.style ?? ''
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
